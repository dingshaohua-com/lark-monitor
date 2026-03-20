import json
import logging
import os
import re
from functools import partial
from pymongo import UpdateOne
from datetime import date, timedelta
import httpx
from server.utils.analyse_msg import extract_msg_text, convert_work_order_content, convert_reply_post_to_html
from server.utils.db_helper import get_collection
from server.utils.date_helper import get_date_range_epoch_ms
from server.utils.classify import classify_issue_type
from server.utils.dedup import deduplicate_docs
from server.service.lark_msg import get_msgs

logger = logging.getLogger(__name__)


# 这样会跳过：
# 已撤回消息（"This message was recalled"）
# 合并转发消息（"Merged and Forwarded Message"）
# 其他无法解析为 JSON 的 content
def _parse_body_content(content):
    """安全解析 body.content：空串、非 JSON 字符串直接返回，避免 json.loads 报错"""
    if isinstance(content, (dict, list)):
        return content
    if not isinstance(content, str):
        return None
    content = content.strip()
    if not content:
        return None
    if content in ("This message was recalled", "Merged and Forwarded Message"):
        return None
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return content if content else None


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


async def get_all(
    page: int | None = None,
    page_size: int | None = None,
    keyword: str | None = None,
    priority: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    has_bot_reply: str | None = None,
    with_reply: bool | None = None,
):
    """查询原始数据接口。page/page_size 不传则返回全部。"""
    raw_col = get_collection("raw_msg")

    # parent_id 过滤不可靠（飞书线程回复可能只有 thread_id 没有 parent_id），用 typeDetail 双重保障
    query: dict = {
        "$or": [
            {"parent_id": {"$exists": False}},
            {"parent_id": None},
            {"parent_id": ""},
        ],
        "ext.typeDetail": {"$in": ["thread_interactive_app", "thread_post_user", "thread_text_user"]},
    }
    extra_conditions = []

    if keyword and keyword.strip():
        keyword_regex = {"$regex": re.escape(keyword.strip()), "$options": "i"}
        extra_conditions.append({"$or": [
            {"ext.parsedContent.user_content": keyword_regex},
            {"ext.rawText": keyword_regex},
        ]})

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

    if has_bot_reply == "yes":
        query["ext.isRepliedByBot"] = True
    elif has_bot_reply == "no":
        query["ext.isRepliedByBot"] = {"$ne": True}
    if extra_conditions:
        query["$and"] = extra_conditions

    total = await raw_col.count_documents(query)

    paginated = page is not None and page_size is not None
    cursor = raw_col.find(query).sort("create_time", -1)
    if paginated:
        cursor = cursor.skip((page - 1) * page_size).limit(page_size)
    items = await cursor.to_list(length=page_size if paginated else None)

    ANNOTATE_API_BASE = os.getenv("ANNOTATE_API_BASE")+'/sq'

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

    # 批量获取回复，用于 issueType 分类（以及 with_reply 挂载）
    if items:
        reply_map = await _batch_get_replies(raw_col, items)
        for it in items:
            tid = it.get("thread_id")
            item_replies = reply_map.get(tid, [])
            it.setdefault("ext", {})["issueType"] = classify_issue_type(item_replies)
            if with_reply:
                it["ext"]["replies"] = item_replies

    return {
        "data": {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    }


async def _batch_get_replies(raw_col, items: list[dict]) -> dict[str, list]:
    """批量获取主消息的回复，按 thread_id 分组返回"""
    thread_ids = list({it.get("thread_id") for it in items if it.get("thread_id")})
    main_ids = [it["_id"] for it in items]
    if not thread_ids:
        return {}
    all_replies = await raw_col.find({
        "thread_id": {"$in": thread_ids},
        "_id": {"$nin": main_ids},
    }).sort("create_time", 1).to_list(length=None)
    reply_map: dict[str, list] = {}
    for r in all_replies:
        reply_map.setdefault(r.get("thread_id"), []).append(r)
    return reply_map


async def sync_collection(collection, items_dic, _items=None, _is_last=None, parent_doc=None):
    """同步至数据库（批量存储）。fetch_msgs 回调传入 (items_dic, items, is_last)， 主消息和回复的存储都会走这里"""
    ops = []
    has_bot_reply = False
    new_main_docs = []
    for doc in items_dic:
        doc["_id"] = doc.get("message_id")
        msg_type = doc.get("msg_type")
        doc_body = doc.get("body")
        doc_body_content = _parse_body_content((doc_body or {}).get("content"))
        if doc_body_content is None or not isinstance(doc_body_content, dict):
            continue
        is_reply = bool(doc.get("parent_id"))
        is_replied_by_bot = is_reply and doc.get("sender", {}).get("sender_type") == "app"
        if is_replied_by_bot:
            has_bot_reply = True
        if msg_type == "interactive":
            title = doc_body_content.get("title") or ""
            if is_reply:
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
                        "typeDetail":"thread_interactive_app",
                        "rawText": title+"\n"+raw_text,
                    }
                    new_main_docs.append(doc)
                    ops.append(UpdateOne({"_id": doc["_id"]}, {"$set": doc}, upsert=True))
        elif msg_type == "post":
            if is_reply:
                doc["ext"] = {
                    "parsedContent": convert_reply_post_to_html(doc_body_content.get("content")),
                    "typeDetail": "reply_post"
                }
                ops.append(UpdateOne({"_id": doc["_id"]}, {"$set": doc}, upsert=True))
            else:
                title = (doc_body_content.get("title") or "").strip()
                raw_text = extract_msg_text(doc_body_content.get("content"))
                doc["ext"] = {
                    "parsedContent": convert_reply_post_to_html(doc_body_content.get("content")),
                    "typeDetail": "thread_post_user",
                    "rawText": (title + "\n" + raw_text).strip() if raw_text else title,
                }
                new_main_docs.append(doc)
                ops.append(UpdateOne({"_id": doc["_id"]}, {"$set": doc}, upsert=True))
        elif msg_type == "text":
            if is_reply:
                doc["ext"] = {
                    "parsedContent": doc_body_content,
                    "typeDetail": "reply_text"
                }
                ops.append(UpdateOne({"_id": doc["_id"]}, {"$set": doc}, upsert=True))
            else:
                raw_text = (doc_body_content.get("text") or "").strip()
                doc["ext"] = {
                    "parsedContent": doc_body_content,
                    "typeDetail": "thread_text_user",
                    "rawText": raw_text,
                }
                new_main_docs.append(doc)
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
        {"ext.typeDetail": {"$in": ["thread_interactive_app", "thread_post_user", "thread_text_user"]}, "_id": {"$nin": new_ids}}
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


async def get_stats(start_date: str | None = None, end_date: str | None = None):
    """统计分析：当前周期 vs 前一周期的机器人参与率、点赞/点踩数据"""
    raw_col = get_collection("raw_msg")

    today = date.today()
    if not start_date:
        start_date = (today - timedelta(days=6)).isoformat()
    if not end_date:
        end_date = today.isoformat()

    start_dt = date.fromisoformat(start_date)
    end_dt = date.fromisoformat(end_date)
    period_days = (end_dt - start_dt).days + 1

    prev_end_dt = start_dt - timedelta(days=1)
    prev_start_dt = prev_end_dt - timedelta(days=period_days - 1)

    current = await _calc_period_stats(raw_col, start_date, end_date)
    previous = await _calc_period_stats(
        raw_col, prev_start_dt.isoformat(), prev_end_dt.isoformat()
    )

    return {
        "data": {
            "current": current,
            "previous": previous,
            "period_days": period_days,
        }
    }


async def _calc_period_stats(raw_col, start_date: str, end_date: str) -> dict:
    """计算单个周期内的统计数据"""
    start_ms, end_ms = get_date_range_epoch_ms(start_date, end_date)

    base_query: dict = {
        "$or": [
            {"parent_id": {"$exists": False}},
            {"parent_id": None},
            {"parent_id": ""},
        ]
    }
    create_time_expr = {"$toLong": {"$ifNull": ["$create_time", "0"]}}
    time_conds = []
    if start_ms is not None:
        time_conds.append({"$gte": [create_time_expr, start_ms]})
    if end_ms is not None:
        time_conds.append({"$lte": [create_time_expr, end_ms]})
    if time_conds:
        expr = {"$and": time_conds} if len(time_conds) > 1 else time_conds[0]
        base_query["$expr"] = expr

    total = await raw_col.count_documents(base_query)

    bot_query = {**base_query, "ext.isRepliedByBot": True}
    bot_replied = await raw_col.count_documents(bot_query)

    upvote_total = 0
    downvote_total = 0

    if bot_replied > 0:
        bot_msgs = await raw_col.find(
            bot_query, {"message_id": 1}
        ).to_list(length=None)
        ticket_ids = [m["message_id"] for m in bot_msgs if m.get("message_id")]
        if ticket_ids:
            try:
                api_base = os.getenv("ANNOTATE_API_BASE", "")
                async with httpx.AsyncClient(timeout=10.0) as client:
                    r = await client.post(
                        f"{api_base}/sq/api/annotate/batch-votes",
                        json={"ticketIds": ticket_ids},
                    )
                    r.raise_for_status()
                    body = r.json()
                    votes_list = (
                        body.get("data", []) if isinstance(body, dict) else []
                    )
                    for v in votes_list:
                        if isinstance(v, dict):
                            upvote_total += v.get("upvoteCount", 0) or 0
                            downvote_total += v.get("downvoteCount", 0) or 0
            except Exception:
                logger.exception("获取投票数据失败")

    # 问题类型分布
    issue_counts = {"技术问题": 0, "非技术问题": 0, "待定": 0}
    if total > 0:
        main_msgs = await raw_col.find(base_query).to_list(length=None)
        reply_map = await _batch_get_replies(raw_col, main_msgs)
        for msg in main_msgs:
            it = classify_issue_type(reply_map.get(msg.get("thread_id"), []))
            issue_counts[it] = issue_counts.get(it, 0) + 1

    return {
        "total": total,
        "bot_replied": bot_replied,
        "upvote_total": upvote_total,
        "downvote_total": downvote_total,
        "issue_counts": issue_counts,
    }


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




