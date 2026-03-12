from pydantic import BaseModel, Field, ConfigDict
from typing import Optional

# 共享基础字段（可选）
class UserBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=50, description="用户名")
    age: int = Field(..., gt=0, lt=150, description="年龄")  # 合理性校验

class UserCreate(UserBase):
    """创建用户：不需要 id，需要 password"""
    password: str = Field(..., min_length=6, description="密码")

class UserUpdate(BaseModel):
    """更新用户：所有字段可选，不传则不更新"""
    name: Optional[str] = Field(None, min_length=2)
    age: Optional[int] = Field(None, gt=0, lt=150)

class UserResponse(UserBase):
    """返回用户：包含 id，排除 password"""
    model_config = ConfigDict(from_attributes=True)  # 兼容 SQLAlchemy ORM
    id: int = Field(..., description="用户ID")
    # password 故意不写，就不会返回