from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

import server.service.bitable as bitable_service
from server.exception.biz_error import BizError

router = APIRouter(prefix="/bitable", tags=["bitable"])


class UploadRequest(BaseModel):
    start_date: Optional[str] = Field(None, description="起始日期 YYYY-MM-DD")
    end_date: Optional[str] = Field(None, description="结束日期 YYYY-MM-DD")
    report_date: Optional[str] = Field(None, description="报告日期（写入多维表格的日期字段），默认使用 start_date")
    app_token: str = Field(bitable_service.DEFAULT_APP_TOKEN, description="多维表格 App Token")
    table_id: str = Field(bitable_service.DEFAULT_TABLE_ID, description="多维表格 Table ID")


@router.get("/preview")
async def preview(
    start_date: Optional[str] = Query(None, description="起始日期 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
):
    """预览符合条件的工单数量及样本（前 20 条）"""
    return await bitable_service.preview_feedbacks(start_date, end_date)


@router.post("/upload")
async def upload(body: UploadRequest):
    """将指定日期范围内的工单上传到飞书多维表格"""
    try:
        result = await bitable_service.upload_feedbacks(
            start_date=body.start_date,
            end_date=body.end_date,
            app_token=body.app_token,
            table_id=body.table_id,
            report_date=body.report_date,
        )
    except RuntimeError as e:
        raise BizError(str(e)) from e
    return result
