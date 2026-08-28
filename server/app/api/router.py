from fastapi import APIRouter

from app.api.routes import auth, health, server_info, workout_data


api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(server_info.router, tags=["server"])
api_router.include_router(auth.router, tags=["authentication"])
api_router.include_router(workout_data.router, tags=["workout data"])
