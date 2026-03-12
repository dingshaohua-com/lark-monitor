from fastapi import APIRouter
from server.service import user as user_service
from server.schema.user import UserResponse

router = APIRouter(prefix="/user", tags=["user"])

@router.get("/")
async def get_all() -> list[UserResponse]:
    return user_service.get_all()

@router.get("/{user_id}")
async def get_by_id(user_id: int) -> UserResponse:
    return user_service.get_by_id(user_id)