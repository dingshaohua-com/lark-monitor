import json
import logging
from fastapi import Request
from fastapi.responses import JSONResponse, Response
from server.exception.biz_error import BizError

logger = logging.getLogger(__name__)


async def wrap_response(request: Request, call_next):
    """将 /api/ 下的 JSON 响应统一包装为 { code: 0, msg: "success", data: ... }"""
    if not request.url.path.startswith("/api/"):
        return await call_next(request)

    try:
        response: Response = await call_next(request)
    except BizError as exc:
        return JSONResponse(
            status_code=200,
            content={"code": 1, "msg": exc.msg, "data": None},
        )
    except Exception as exc:
        logger.exception("未处理的异常: %s", exc)
        return JSONResponse(
            status_code=200,
            content={"code": 1, "msg": f"服务器内部错误: {exc}", "data": None},
        )

    content_type = response.headers.get("content-type", "")
    if "application/json" not in content_type:
        return response

    body = b""
    async for chunk in response.body_iterator:
        body += chunk
    data = json.loads(body)

    return JSONResponse(
        status_code=response.status_code,
        content={"code": 0, "msg": "success", "data": data},
    )
