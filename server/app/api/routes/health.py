from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends

from app.api.dependencies import require_database
from app.core.config import Settings, get_settings
from app.schemas.api import HealthResponse


router = APIRouter()


def health_response(
    settings: Settings,
    database: Literal["connected", "not_checked"],
) -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="liftflow-api",
        version=settings.server_version,
        api_version=settings.api_version,
        database=database,
        timestamp=datetime.now(timezone.utc),
    )


@router.get("/health/live", response_model=HealthResponse)
async def liveness(settings: Settings = Depends(get_settings)) -> HealthResponse:
    return health_response(settings, "not_checked")


@router.get("/health", response_model=HealthResponse)
@router.get("/health/ready", response_model=HealthResponse, include_in_schema=False)
async def readiness(
    database: Literal["connected"] = Depends(require_database),
    settings: Settings = Depends(get_settings),
) -> HealthResponse:
    return health_response(settings, database)
