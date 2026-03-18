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
    page: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")
    keyword: Optional[str] = Field(None, description="关键字搜索（用户原文/客服备注）")
    priority: Optional[str] = Field(None, description="优先级，如 P0、P1")
    start_date: Optional[str] = Field(None, description="起始日期，如 2026-01-01")
    end_date: Optional[str] = Field(None, description="结束日期，如 2026-01-31")
    has_bot_reply: Optional[str] = Field(None, description="是否有机器人回复：yes/no")
