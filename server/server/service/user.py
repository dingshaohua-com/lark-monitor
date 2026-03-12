from server.exception.biz_error import BizError

_USERS = [
    {"id": 1, "name": "张三", "age": 18},
    {"id": 2, "name": "李四", "age": 20},
]


def get_all():
    return _USERS


def get_by_id(user_id: int):
    user = next((u for u in _USERS if u["id"] == user_id), None)
    if user is None:
        raise BizError(f"用户 {user_id} 不存在")
    return user