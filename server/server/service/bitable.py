"""将工单数据上传到飞书多维表格"""
import os
import logging
from datetime import datetime

import httpx

from server.utils.analyse_msg import extract_reply_document_text
from server.utils.db_helper import get_collection
from server.utils.date_helper import get_date_range_epoch_ms
from server.utils.classify import classify_issue_type

logger = logging.getLogger(__name__)

DEFAULT_APP_TOKEN = "Sywxb4dh8aeRZJsvD3WcDiXDnnc"
DEFAULT_TABLE_ID = "tblt7L2vgw70yE3F"

_STATUS_MAP = {
    "技术问题": "技术",
    "非技术问题": "非技术",
    "待定": "待定",
}


async def get_tenant_access_token() -> str | None:
    app_id = os.environ.get("LARK_APP_ID", "")
    app_secret = os.environ.get("LARK_APP_SECRET", "")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(
                "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
                json={"app_id": app_id, "app_secret": app_secret},
            )
            data = res.json()
            if data.get("code") == 0:
                return data.get("tenant_access_token")
            logger.error("获取 access_token 失败: %s", data)
    except Exception:
        logger.exception("获取 access_token 异常")
    return None


async def _query_work_orders(start_date: str | None, end_date: str | None) -> list[dict]:
    """按日期范围查询工单，并批量附加回复列表"""
    raw_col = get_collection("raw_msg")

    query: dict = {
        "$or": [
            {"parent_id": {"$exists": False}},
            {"parent_id": None},
            {"parent_id": ""},
        ],
        "ext.typeDetail": {"$in": ["thread_interactive_app", "thread_post_user", "thread_text_user"]},
    }

    start_ms, end_ms = get_date_range_epoch_ms(start_date, end_date)
    create_time_expr = {"$toLong": {"$ifNull": ["$create_time", "0"]}}
    time_conditions = []
    if start_ms is not None:
        time_conditions.append({"$gte": [create_time_expr, start_ms]})
    if end_ms is not None:
        time_conditions.append({"$lte": [create_time_expr, end_ms]})
    if len(time_conditions) == 1:
        query["$and"] = [{"$expr": time_conditions[0]}]
    elif len(time_conditions) == 2:
        query["$and"] = [{"$expr": {"$and": time_conditions}}]

    items = await raw_col.find(query).sort("create_time", -1).to_list(length=None)

    thread_ids = list({it.get("thread_id") for it in items if it.get("thread_id")})
    main_ids = [it["_id"] for it in items]
    reply_map: dict[str, list] = {}
    if thread_ids:
        all_replies = await raw_col.find(
            {"thread_id": {"$in": thread_ids}, "_id": {"$nin": main_ids}}
        ).sort("create_time", 1).to_list(length=None)
        for r in all_replies:
            reply_map.setdefault(r.get("thread_id"), []).append(r)

    for item in items:
        item["_replies"] = reply_map.get(item.get("thread_id"), [])

    return items


def _build_fields(item: dict, report_date: str | None) -> dict:
    """将工单文档映射为多维表格字段，反馈原文直接从 ext.rawText 取"""
    parsed = item.get("ext", {}).get("parsedContent", {}) or {}
    replies: list = item.get("_replies", [])

    feedback_id = parsed.get("feedback_id") or item.get("message_id", "")
    feedback_text = item.get("ext", {}).get("rawText", "")
    client_type = parsed.get("client_type", "无法判断") or "无法判断"
    issue_type = classify_issue_type(replies)

    reply_texts = [extract_reply_document_text(r) for r in replies]
    reply_content = "\n---\n".join(t for t in reply_texts if t)

    fields: dict = {
        "反馈 ID": str(feedback_id),
        "反馈原文": feedback_text,
        "回复内容": reply_content,
        "状态": _STATUS_MAP.get(issue_type, "待定"),
        "客户端": client_type,
    }

    if report_date:
        try:
            dt = datetime.strptime(report_date, "%Y-%m-%d")
            fields["日期"] = int(dt.timestamp() * 1000)
        except Exception:
            pass

    return fields


async def preview_feedbacks(start_date: str | None, end_date: str | None) -> dict:
    """预览将要上传的工单数量及样本"""
    items = await _query_work_orders(start_date, end_date)

    previews = []
    for item in items[:20]:
        parsed = item.get("ext", {}).get("parsedContent", {}) or {}
        replies: list = item.get("_replies", [])
        previews.append({
            "feedback_id": parsed.get("feedback_id") or item.get("message_id", ""),
            "user_content": (parsed.get("user_content", "") or "")[:120],
            "client_type": parsed.get("client_type", "无法判断") or "无法判断",
            "issue_type": classify_issue_type(replies),
            "reply_count": len(replies),
        })

    return {"total": len(items), "items": previews}


async def upload_feedbacks(
    start_date: str | None,
    end_date: str | None,
    app_token: str,
    table_id: str,
    report_date: str | None = None,
) -> dict:
    """将工单批量上传到飞书多维表格，返回上传统计"""
    token = await get_tenant_access_token()
    if not token:
        raise RuntimeError("无法获取飞书访问令牌，请检查 LARK_APP_ID / LARK_APP_SECRET 配置")

    items = await _query_work_orders(start_date, end_date)
    total = len(items)

    url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json; charset=utf-8",
    }

    uploaded = 0
    failed = 0
    errors: list[str] = []

    async with httpx.AsyncClient(timeout=15) as client:
        for item in items:
            fields = _build_fields(item, report_date or start_date)
            feedback_id = fields.get("反馈 ID", "unknown")
            try:
                res = await client.post(url, headers=headers, json={"fields": fields})
                data = res.json()
                if data.get("code") == 0:
                    uploaded += 1
                else:
                    failed += 1
                    errors.append(f"反馈ID {feedback_id}: {data.get('msg', 'Unknown error')}")
            except Exception as e:
                failed += 1
                errors.append(f"反馈ID {feedback_id}: {e}")

    return {"total": total, "uploaded": uploaded, "failed": failed, "errors": errors}
