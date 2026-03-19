from datetime import date
from pydantic import BaseModel, Field
from typing import Optional


class SyncRequest(BaseModel):
    """同步请求体"""
    mode: str = Field("continue", description="continue=从上次继续, range=指定时间段")
    start: Optional[date] = Field(None, description="起始日期 YYYY-MM-DD")
    end: Optional[date] = Field(None, description="结束日期 YYYY-MM-DD")


class StatsQuery(BaseModel):
    start_date: Optional[str] = Field(None, description="起始日期 YYYY-MM-DD")
    end_date: Optional[str] = Field(None, description="结束日期 YYYY-MM-DD")


class RawMsgQuery(BaseModel):
    page: Optional[int] = Field(None, ge=1, description="页码，不传则返回全部")
    page_size: Optional[int] = Field(None, ge=1, le=500, description="每页数量，不传则返回全部")
    keyword: Optional[str] = Field(None, description="关键字搜索（用户原文/客服备注）")
    priority: Optional[str] = Field(None, description="优先级，如 P0、P1")
    start_date: Optional[str] = Field(None, description="起始日期，如 2026-01-01")
    end_date: Optional[str] = Field(None, description="结束日期，如 2026-01-31")
    has_bot_reply: Optional[str] = Field(None, description="是否有机器人回复：yes/no")
    with_reply: Optional[bool] = Field(None, description="是否携带回复列表到 ext.replies")
