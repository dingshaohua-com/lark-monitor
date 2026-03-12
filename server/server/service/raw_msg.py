import logging
import os
from datetime import date, datetime, timedelta, timezone
from traceback import print_tb
from server.utils.date_helper import get_full_date_time

from fastapi import FastAPI
from lark_oapi.api.im.v1 import ListMessageRequest
from server.utils.lark_client import get_lark_client
from server.utils.db_helper import get_collection



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


async def sync(
    start: date | None = None,
    end: date | None = None,
) :
    """从飞书群拉取原始消息（含话题回复）同步到表"""
    # start_dt = datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc) if start else now - timedelta(days=7)
    # end_dt = datetime.combine(end, datetime.max.time(), tzinfo=timezone.utc) if end else now
    # start_ts = str(int(start_dt.timestamp()))
    # end_ts = str(int(end_dt.timestamp()))




    # chat_id = os.environ["MONITOR_CHAT_ID"]
    # start, end = get_full_date_time(start, end, timestamp=True)
    #  # 第一步：拉取群聊主消息
    # builder = (
    #     ListMessageRequest.builder()
    #     .container_id_type("chat")
    #     .container_id(chat_id)
    #     .page_size(3)
    #     .start_time(start)
    #     .end_time(end)
    # )
    # response = await client.im.v1.message.alist(builder.build())
    # data = response.data
    # return data

    client = get_lark_client()

    # 第一步：拉取群聊主消息
    chat_id = os.environ["MONITOR_CHAT_ID"]
    chat_items = await _fetch_msgs(client,"chat", chat_id, start, end)
    return chat_items


async def _fetch_msgs(client, container_type: str, container_id: str, start, end):
    print(container_type, container_id)
    page_token: str | None = None
    all_items: list[dict] = []
    while True:
        builder = (
            ListMessageRequest.builder()
            .container_id_type(container_type)
            .container_id(container_id)
            .page_size(3)
            .start_time(start)
            .end_time(end)
        )
        if page_token:
            builder = builder.page_token(page_token)
        response = await client.im.v1.message.alist(builder.build())
        # print(response.data)
        return response
        items = response.data.items or []
        all_items.extend(items)

        # 终止条件
        if not response.data.has_more:
            break
        page_token = response.data.page_token
    return all_items


async def clear_all():
    """删除所有原始数据。"""
    raw_col = get_collection("raw_msg")
    raw_result = await raw_col.delete_many({})
    return raw_result.deleted_count




