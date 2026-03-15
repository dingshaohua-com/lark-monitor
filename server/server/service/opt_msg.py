import json
import re
from functools import partial
from pymongo import UpdateOne
from datetime import date, datetime, timedelta, timezone
from server.utils.analyse_msg import extract_msg_text, convert_work_order_content, convert_reply_post_to_html
from server.utils.db_helper import get_collection
from server.service.lark_msg import get_msgs



def _build_main_query() -> dict:
    return {
        "$or": [
            {"parent_id": {"$exists": False}},
            {"parent_id": None},
            {"parent_id": ""},
        ]
    }


def _to_epoch_ms(date_str: str | None, *, end_of_day: bool = False) -> int | None:
    if not date_str:
        return None
    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    if end_of_day:
        dt = dt + timedelta(days=1) - timedelta(milliseconds=1)
    return int(dt.timestamp() * 1000)


async def get_replies(message_id: str):
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

    conditions = [_build_main_query()]

    if keyword and keyword.strip():
        keyword_regex = {"$regex": re.escape(keyword.strip()), "$options": "i"}
        conditions.append({
            "$or": [
                {"body.content": keyword_regex},
                {"body.parsedContent.value": keyword_regex},
                {"body.parsedContent.user_content": keyword_regex},
            ]
        })

    if priority:
        conditions.append({
            "body.parsedContent": {
                "$elemMatch": {
                    "key": "priority",
                    "value": priority,
                }
            }
        })

    start_ms = _to_epoch_ms(start_date)
    end_ms = _to_epoch_ms(end_date, end_of_day=True)
    create_time_expr = {"$toLong": {"$ifNull": ["$create_time", "0"]}}
    if start_ms is not None:
        conditions.append({"$expr": {"$gte": [create_time_expr, start_ms]}})
    if end_ms is not None:
        conditions.append({"$expr": {"$lte": [create_time_expr, end_ms]}})

    if has_bot_reply in {"yes", "no"}:
        conditions.append({"has_bot_reply": has_bot_reply == "yes"})

    query = conditions[0] if len(conditions) == 1 else {"$and": conditions}

    total = await raw_col.count_documents(query)
    skip = (page - 1) * page_size
    items = await raw_col.find(query).sort("create_time", -1).skip(skip).limit(page_size).to_list(length=page_size)

    return {
        "data": {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    }


async def sync_collection(collection, items_dic, _items=None, _is_last=None):
    """同步至数据库（批量存储）。fetch_msgs 回调传入 (items_dic, items, is_last)， 主消息和回复的存储都会走这里"""
    ops = []
    for doc in items_dic:
        doc["_id"] = doc.get("message_id")
        msg_type = doc.get("msg_type")
        doc_body = doc.get("body")
        doc_body_content = json.loads(doc_body.get("content")) # 将json字符串转为python可识别的对象
        is_reply = bool(doc.get("parent_id"))
        # 卡片式可交互类型的消息解析（可能是回复或主消息）
        if msg_type == "interactive":
            if is_reply:
                doc["ext"]={
                    "parsedContent":extract_msg_text(doc_body_content),
                    "typeDetail": "reply_interactive"
                }
                ops.append(UpdateOne({"_id": doc["_id"]}, {"$set": doc}, upsert=True))
            else:
                # 只同步机器人提供的工单消息(人提的不管，格式太乱)
                if doc.get("sender").get('sender_type') == "app":
                    raw_text = doc_body_content.get("elements")[0][0].get("text")
                    # doc["body"]["parsedContent"] = convert_work_order_content(raw_text)
                    doc["ext"] = {
                        "parsedContent": convert_work_order_content(raw_text),
                        "typeDetail":"thread_interactive_app"
                    }
                    ops.append(UpdateOne({"_id": doc["_id"]}, {"$set": doc}, upsert=True))
        elif msg_type == "post":
            print("this is reply")
            # doc["body"]["parsedContent"] =  {
            #     "user_content": convert_reply_post_to_html(doc_body_content.get("content"))
            # }
            doc["ext"] = {
                "parsedContent":convert_reply_post_to_html(doc_body_content.get("content")),
                "typeDetail": "reply_post"
            }
            ops.append(UpdateOne({"_id": doc["_id"]}, {"$set": doc}, upsert=True))
        elif msg_type == "text":
            print("this is reply")
            # doc["body"]["parsedContent"] = {"user_content": doc_body_content}
            doc["ext"] = {
                "parsedContent": doc_body_content,
                "typeDetail": "reply_text"
            }
            ops.append(UpdateOne({"_id": doc["_id"]}, {"$set": doc}, upsert=True))
    if ops:
       await collection.bulk_write(ops)


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




