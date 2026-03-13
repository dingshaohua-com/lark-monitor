import os
import json
import asyncio
import lark_oapi as lark
from lark_oapi.api.im.v1 import ListMessageRequest

_client: lark.Client | None = None

def init_lark_client():
    global _client
    _client = (
        lark.Client.builder()
        .app_id(os.environ["LARK_APP_ID"])
        .app_secret(os.environ["LARK_APP_SECRET"])
        .log_level(lark.LogLevel.INFO)
        .build()
    )


def get_lark_client() -> lark.Client:
    if _client is None:
        raise RuntimeError("Lark client not initialized")
    return _client


# 自动循环获取指定日期的所有数据
async def fetch_msgs(client, container_type: str, container_id: str, start, end, callback):
    print(container_type, container_id)
    page_token: str | None = None
    all_items: list[dict] = []
    page_num = 0
    while True:
        page_num += 1
        builder = (
            ListMessageRequest.builder()
            .container_id_type(container_type)
            .container_id(container_id)
            .page_size(50)
            .start_time(start)
            .end_time(end)
        )
        if page_token:
            builder = builder.page_token(page_token)

        response = await client.im.v1.message.alist(builder.build())
        if not response.success(): # ✅ 必须检查成功标志
            print(f"拉取失败! 错误码: {response.code}, 信息: {response.msg}")
            break
        items = response.data.items or []

        # 直接过滤 items 列表（排除回复还包含主消息的坑）
        if container_type == 'thread':
            items = [item for item in items if getattr(item, "parent_id", None)]

        is_last = not response.data.has_more

        # 给外部使用: 通知本次拉取完成
        items_dic = [json.loads(lark.JSON.marshal(item)) for item in items]

        if callback:
            result = callback(items_dic, items, is_last)
            if asyncio.iscoroutine(result):
                await result

        all_items.extend(items_dic)

        # 终止条件
        if is_last:
            break
        page_token = response.data.page_token

        # ✅ 防止限流：添加短暂延迟（可选），每10页暂停半秒
        if page_num % 10 == 0:
            await asyncio.sleep(0.5)
    return all_items