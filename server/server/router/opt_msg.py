from fastapi import APIRouter, Body, Depends
from server.schema.raw_msg import RawMsgQuery, SyncRequest
import server.service.opt_msg as raw_msg_service
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
async def sync(body: SyncRequest = Body(...)):
    start = body.start
    end = body.end
    if body.mode == "range" and not start:
        # range 模式必须提供 start
        start = end  # 若只传了 end，用 end 作为 start
    result = await raw_msg_service.sync(start, end)
    return result

@router.delete("/all")
async def clear_all():
    result = await raw_msg_service.clear_all()
    return result




