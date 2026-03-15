import logging
import os
import json
from functools import partial
from pymongo import UpdateOne
from datetime import date, datetime, timedelta, timezone
from traceback import print_tb
from server.utils.analyse_msg import extract_msg_text, convert_work_order_content, convert_aplay_post_to_html
from server.utils.date_helper import get_full_date_time
from fastapi import FastAPI
from server.utils.lark_helper import get_lark_client, fetch_msgs
from server.utils.db_helper import get_collection
from server.service.lark_msg import get_msgs



def get_all(  page: int = 1,
    page_size: int = 20,
    keyword: str | None = None,
    priority: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    has_bot_reply: str | None = None):
        # -> list[RawMsg]:
    """查询原始数据接口"""
    pass


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
                print("this is aplay")
                doc["body"]["parsedContent"] = {"user_content": extract_msg_text(doc_body_content)}
                ops.append(UpdateOne({"_id": doc["_id"]}, {"$set": doc}, upsert=True))
            else:
                # 只同步机器人提供的工单消息(人提的不管，格式太乱)
                if doc.get("sender").get('sender_type') == "app":
                    raw_text = doc_body_content.get("elements")[0][0].get("text")
                    doc["body"]["parsedContent"] = convert_work_order_content(raw_text)
                    ops.append(UpdateOne({"_id": doc["_id"]}, {"$set": doc}, upsert=True))
        elif msg_type == "post":
            print("this is aplay")
            doc["body"]["parsedContent"] =  {
                "user_content": convert_aplay_post_to_html(doc_body_content.get("content"))
            }
            ops.append(UpdateOne({"_id": doc["_id"]}, {"$set": doc}, upsert=True))
        elif msg_type == "text":
            print("this is aplay")
            doc["body"]["parsedContent"] = {"user_content": doc_body_content}
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




