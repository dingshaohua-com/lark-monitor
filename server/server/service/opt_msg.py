import json
import logging
import os
import re
from functools import partial
from pymongo import UpdateOne
from datetime import date
import httpx
from server.utils.analyse_msg import extract_msg_text, convert_work_order_content, convert_reply_post_to_html
from server.utils.db_helper import get_collection
from server.utils.date_helper import get_date_range_epoch_ms
from server.utils.dedup import deduplicate_docs
from server.service.lark_msg import get_msgs

logger = logging.getLogger(__name__)

ANNOTATE_API_BASE = os.getenv("ANNOTATE_API_BASE")+'/annotate'


async def get_replies(message_id: str):
    """查询指定消息的回复"""
    raw_col = get_collection("raw_msg")
    items = await raw_col.find({"parent_id": message_id}).sort("create_time", 1).to_list(length=None)
    return {
        "data": {
            "message_id": message_id,
            "items": items,
            "total": len(items),
        }
    }


async def get_all(  page: int = 1,
    page_size: int = 20,
    keyword: str | None = None,
    priority: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    has_bot_reply: str | None = None):
    """查询原始数据接口"""
    raw_col = get_collection("raw_msg")

    query = {
        "$or": [
            {"parent_id": {"$exists": False}},
            {"parent_id": None},
            {"parent_id": ""},
        ]
    }
    extra_conditions = []

    if keyword and keyword.strip():
        keyword_regex = {"$regex": re.escape(keyword.strip()), "$options": "i"}
        query["ext.parsedContent.user_content"] = keyword_regex

    if priority:
        query["ext.parsedContent.priority"] = priority

    start_ms, end_ms = get_date_range_epoch_ms(start_date, end_date)
    create_time_expr = {"$toLong": {"$ifNull": ["$create_time", "0"]}}
    time_conditions = []
    if start_ms is not None:
        time_conditions.append({"$gte": [create_time_expr, start_ms]})
    if end_ms is not None:
        time_conditions.append({"$lte": [create_time_expr, end_ms]})
    if len(time_conditions) == 1:
        extra_conditions.append({"$expr": time_conditions[0]})
    elif len(time_conditions) == 2:
        extra_conditions.append({"$expr": {"$and": time_conditions}})

    if has_bot_reply in {"yes", "no"}:
        query["ext.isRepliedByBot"] = has_bot_reply == "yes"
    if extra_conditions:
        query["$and"] = extra_conditions

    total = await raw_col.count_documents(query)
    skip = (page - 1) * page_size
    items = await raw_col.find(query).sort("create_time", -1).skip(skip).limit(page_size).to_list(length=page_size)

    # 获取机器人回复的点赞点踩情况，挂到 items 内
    if items:
        ticket_ids = [it.get("message_id") for it in items if it.get("message_id")]
        if ticket_ids:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    r = await client.post(
                        f"{ANNOTATE_API_BASE}/api/annotate/batch-votes",
                        json={"ticketIds": ticket_ids},
                    )
                    r.raise_for_status()
                    body = r.json()
                    votes_list = body.get("data", []) if isinstance(body, dict) else []
                    votes_map = {v["ticketId"]: v for v in votes_list if isinstance(v, dict) and v.get("ticketId")}
            except Exception:
                votes_map = {}
            else:
                for it in items:
                    mid = it.get("message_id")
                    if mid and mid in votes_map:
                        it.setdefault("ext", {})["votes"] = votes_map[mid]

    return {
        "data": {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    }


async def sync_collection(collection, items_dic, _items=None, _is_last=None, parent_doc=None):
    """同步至数据库（批量存储）。fetch_msgs 回调传入 (items_dic, items, is_last)， 主消息和回复的存储都会走这里"""
    ops = []
    has_bot_reply = False
    new_main_docs = []
    for doc in items_dic:
        doc["_id"] = doc.get("message_id")
        msg_type = doc.get("msg_type")
        doc_body = doc.get("body")
        if (doc_body or {}).get("content") == "This message was recalled":
            continue
        doc_body_content = json.loads(doc_body.get("content"))
        is_reply = bool(doc.get("parent_id"))
        is_replied_by_bot = is_reply and doc.get("sender", {}).get("sender_type") == "app"
        if is_replied_by_bot:
            has_bot_reply = True
        if msg_type == "interactive":
            if is_reply:
                title = doc_body_content.get("title") or ""
                elements_html = convert_reply_post_to_html(doc_body_content.get("elements"))
                parsed_content = "\n".join(p for p in [title, elements_html] if p)
                doc["ext"]={
                    "parsedContent": parsed_content,
                    "typeDetail": "reply_interactive"
                }
                ops.append(UpdateOne({"_id": doc["_id"]}, {"$set": doc}, upsert=True))
            else:
                if doc.get("sender").get('sender_type') == "app":
                    raw_text = doc_body_content.get("elements")[0][0].get("text")
                    parsedContent=convert_work_order_content(raw_text)
                    doc["ext"] = {
                        "parsedContent": parsedContent,
                        "typeDetail":"thread_interactive_app"
                    }
                    new_main_docs.append(doc)
                    ops.append(UpdateOne({"_id": doc["_id"]}, {"$set": doc}, upsert=True))
        elif msg_type == "post":
            doc["ext"] = {
                "parsedContent":convert_reply_post_to_html(doc_body_content.get("content")),
                "typeDetail": "reply_post"
            }
            ops.append(UpdateOne({"_id": doc["_id"]}, {"$set": doc}, upsert=True))
        elif msg_type == "text":
            doc["ext"] = {
                "parsedContent": doc_body_content,
                "typeDetail": "reply_text"
            }
            ops.append(UpdateOne({"_id": doc["_id"]}, {"$set": doc}, upsert=True))

    if new_main_docs:
        await _mark_repeat_docs(collection, new_main_docs)

    if parent_doc and has_bot_reply:
        ops.append(UpdateOne({"_id": parent_doc["message_id"]}, {"$set": {"ext.isRepliedByBot": True}}))
    if ops:
       await collection.bulk_write(ops)


async def _mark_repeat_docs(collection, new_docs: list[dict]):
    """对新入库的主消息做去重标记：与库中已有主消息比对，相似的标记 isRepeat + repeatList"""
    new_ids = [d["_id"] for d in new_docs]
    existing_docs = await collection.find(
        {"ext.typeDetail": "thread_interactive_app", "_id": {"$nin": new_ids}}
    ).to_list(length=None)

    all_docs = existing_docs + new_docs
    if len(all_docs) < 2:
        return

    try:
        groups = deduplicate_docs(all_docs)
    except Exception:
        logger.exception("去重计算失败，跳过标记")
        return

    existing_count = len(existing_docs)
    for group in groups:
        if len(group) <= 1:
            continue
        group_ids = [all_docs[i]["_id"] for i in group]
        for idx in group:
            if idx >= existing_count:
                doc = all_docs[idx]
                repeat_ids = [gid for gid in group_ids if gid != doc["_id"]]
                doc["ext"]["isRepeat"] = True
                doc["ext"]["repeatList"] = repeat_ids


async def sync(start: date | None = None, end: date | None = None) :
    """从飞书群拉取原始消息（含话题回复）同步到表"""
    raw_col = get_collection("raw_msg")
    bound_callback = partial(sync_collection, raw_col)
    await get_msgs(start, end, bound_callback)
    return True



async def clear_all():
    """删除所有原始数据。"""
    raw_col = get_collection("raw_msg")
    raw_result = await raw_col.delete_many({})
    return raw_result.deleted_count




