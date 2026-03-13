from datetime import date
from fastapi import APIRouter
import server.service.lark_msg as lark_msg_service

router = APIRouter(prefix="/lark-msg", tags=["lark-msg"])

@router.get("/")
async def get_msgs(start: date | None = None, end: date | None = None):
    result = await lark_msg_service.get_msgs(start, end)
    return result
