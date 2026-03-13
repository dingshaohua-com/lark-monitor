import logging
import os
from functools import partial
from pymongo import UpdateOne
from datetime import date, datetime, timedelta, timezone
from traceback import print_tb
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
    """同步至数据库（批量存储）。fetch_msgs 回调传入 (items_dic, items, is_last)"""
    ops = []
    for doc in items_dic:
        doc["_id"] = doc.get("message_id")
        ops.append(UpdateOne({"_id": doc["_id"]}, {"$set": doc}, upsert=True))
    if ops:
       await collection.bulk_write(ops)

# async def sync(start: date | None = None, end: date | None = None) :
#     """从飞书群拉取原始消息（含话题回复）同步到表"""
#     client = get_lark_client()
#     start, end = get_full_date_time(start, end, timestamp=True)
#
#     # 第一步：拉取群聊主消息（即话题）并入库
#     chat_id = os.environ["MONITOR_CHAT_ID"]
#     raw_col = get_collection("raw_msg")
#     bound_callback = partial(sync_collection, raw_col)
#     chat_items = await fetch_msgs(client,"chat", chat_id, start, end, bound_callback)
#
#     # 第二步：对有 thread_id 的消息，拉取话题内的回复
#     for msg in chat_items:
#         thread_id = msg.get("thread_id")
#          # 跳过主消息（通过 ID 比对或层级判断）
#         if thread_id == msg.get("message_id"):
#             continue
#         if thread_id:
#             thread_items = await fetch_msgs(client,"thread", thread_id, start, end, bound_callback)
#             msg['reply']=thread_items
#     return chat_items


async def sync(start: date | None = None, end: date | None = None) :
    """从飞书群拉取原始消息（含话题回复）同步到表"""
    start, end = get_full_date_time(start, end, timestamp=True)
    raw_col = get_collection("raw_msg")
    bound_callback = partial(sync_collection, raw_col)
    await get_msgs(start, end, bound_callback)
    return True



async def clear_all():
    """删除所有原始数据。"""
    raw_col = get_collection("raw_msg")
    raw_result = await raw_col.delete_many({})
    return raw_result.deleted_count




