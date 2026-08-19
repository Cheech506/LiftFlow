from fastapi import APIRouter

from app.api.routes import health, server_info


api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(server_info.router, tags=["server"])
