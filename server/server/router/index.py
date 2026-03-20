# router/index.py
from fastapi import APIRouter
from . import root, dict, user, lark_msg, opt_msg, bitable

# 创建父路由，统一添加 /api 前缀
router = APIRouter(prefix="/api")

# 将所有子路由注册到父路由
router.include_router(root.router)
router.include_router(dict.router)
router.include_router(user.router)
router.include_router(lark_msg.router)
router.include_router(opt_msg.router)
router.include_router(bitable.router)