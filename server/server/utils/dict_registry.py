_REGISTRY: dict[str, dict] = {}


def register(name: str, data: dict) -> None:
    _REGISTRY[name] = data


def get(name: str) -> dict | None:
    return _REGISTRY.get(name)


def get_all() -> dict[str, dict]:
    return _REGISTRY


def list_names() -> list[str]:
    return list(_REGISTRY.keys())


register("user-info", {
    "name": "姓名",
    "age": "年龄"
})
