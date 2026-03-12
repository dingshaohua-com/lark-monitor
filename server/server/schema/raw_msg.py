from pydantic import BaseModel, Field
from typing import Optional


class RawMsgQuery(BaseModel):
    page: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")
    keyword: Optional[str] = Field(None, description="关键字搜索（用户原文/客服备注）")
    priority: Optional[str] = Field(None, description="优先级，如 P0、P1")
    start_date: Optional[str] = Field(None, description="起始日期，如 2026-01-01")
    end_date: Optional[str] = Field(None, description="结束日期，如 2026-01-31")
    has_bot_reply: Optional[str] = Field(None, description="是否有机器人回复：yes/no")
