from fastapi import APIRouter, Query
from server.utils import dict_registry
from server.exception.biz_error import BizError

router = APIRouter(prefix="/dict", tags=["dict"])

@router.get("/")
async def list_dicts():
    return dict_registry.list_names()


@router.get("/detail")
async def get_dict(
    name: str = Query(..., description="字典名称，如 user-info"),
):
    data = dict_registry.get(name)
    if data is None:
        raise BizError("字典不存在")
    return data
