from fastapi import APIRouter, Depends

from app.api.dependencies import (
    AuthenticatedOwner,
    get_workout_data_service,
    require_authenticated_owner,
)
from app.schemas.workout_data import (
    DataSummaryResponse,
    SnapshotResponse,
    SnapshotWriteRequest,
    SnapshotWriteResponse,
)
from app.services.workout_data import WorkoutDataService


router = APIRouter(prefix="/data")


@router.get("/summary", response_model=DataSummaryResponse)
async def data_summary(
    principal: AuthenticatedOwner = Depends(require_authenticated_owner),
    service: WorkoutDataService = Depends(get_workout_data_service),
) -> DataSummaryResponse:
    return await service.summary(principal.owner.id)


@router.get("/snapshot", response_model=SnapshotResponse)
async def get_snapshot(
    principal: AuthenticatedOwner = Depends(require_authenticated_owner),
    service: WorkoutDataService = Depends(get_workout_data_service),
) -> SnapshotResponse:
    return await service.load_snapshot(principal.owner.id)


@router.put("/snapshot", response_model=SnapshotWriteResponse)
async def replace_snapshot(
    request: SnapshotWriteRequest,
    principal: AuthenticatedOwner = Depends(require_authenticated_owner),
    service: WorkoutDataService = Depends(get_workout_data_service),
) -> SnapshotWriteResponse:
    return await service.replace_snapshot(principal.owner.id, request)
