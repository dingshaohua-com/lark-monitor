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


async def get_msgs(start: date | None = None, end: date | None = None, callback=None) :
    """从飞书群拉取原始消息（含话题回复）同步到表"""
    client = get_lark_client()
    start, end = get_full_date_time(start, end, timestamp=True)

    # 第一步：拉取群聊主消息（即话题）并入库
    chat_id = os.environ["MONITOR_CHAT_ID"]
    chat_items = await fetch_msgs(client,"chat", chat_id, start, end, callback)

    # 第二步：对有 thread_id 的消息，拉取话题内的回复
    for msg in chat_items:
        thread_id = msg.get("thread_id")
         # 跳过主消息（通过 ID 比对或层级判断）
        if thread_id == msg.get("message_id"):
            continue
        if thread_id:
            thread_items = await fetch_msgs(client,"thread", thread_id, start, end, callback, parent_doc=msg) # 表明这里是回复类型的消息，把主消息传进去，方便添加是否有机器人回复用
            msg['replies']=thread_items
    return chat_items