from fastapi import APIRouter, Depends
from server.schema.raw_msg import RawMsgQuery
import server.service.raw_msg as raw_msg_service
from datetime import date, datetime, timedelta, timezone

router = APIRouter(prefix="/raw-msg", tags=["raw-msg"])

@router.get("/")
async def get_all(query: RawMsgQuery = Depends()):
    result = await raw_msg_service.get_all(
        page=query.page, page_size=query.page_size,
        keyword=query.keyword, priority=query.priority,
        start_date=query.start_date, end_date=query.end_date,
        has_bot_reply=query.has_bot_reply,
    )
    return result


@router.post("/sync")
async def sync(  start: date | None = None, end: date | None = None):
    result = await raw_msg_service.sync(start, end)
    return result

@router.delete("/all")
async def clear_all():
    result = await raw_msg_service.clear_all()
    return result




