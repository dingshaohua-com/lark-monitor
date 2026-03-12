class BizError(Exception):
    """业务异常，抛出后由全局处理器统一返回 JSON 响应"""

    def __init__(self, status_code: int = 1, detail: str = "业务异常"):
        self.status_code = status_code
        self.detail = detail
