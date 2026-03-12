class BizError(Exception):
    """业务异常，抛出后由全局处理器统一返回 { code: 1, msg, data: null }"""

    def __init__(self, msg: str = "业务异常"):
        self.msg = msg
