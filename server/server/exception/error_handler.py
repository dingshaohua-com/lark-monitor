import logging
from fastapi import Request
from fastapi.responses import JSONResponse
from server.exception.biz_error import BizError

logger = logging.getLogger(__name__)


async def biz_error_handler(_req: Request, exc: BizError):
    return JSONResponse(
        status_code=200,
        content={"code": 1, "msg": exc.msg, "data": None},
    )


async def global_error_handler(_req: Request, exc: Exception):
    logger.exception("未处理的异常: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"code": 1, "msg": "服务器内部错误", "data": None},
    )
