import json
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi import HTTPException
from httpx import AsyncClient

from app.api.dependencies import (
    AuthenticatedOwner,
    get_workout_data_service,
    require_authenticated_owner,
)
from app.schemas.workout_data import (
    DataSummaryResponse,
    SnapshotCounts,
    SnapshotResponse,
    SnapshotRow,
    SnapshotTables,
    SnapshotWriteRequest,
    SnapshotWriteResponse,
)
from app.core.config import Settings
from app.services.workout_data import (
    WorkoutDataService,
    projection_hash_for_tables,
    validate_snapshot_relationships,
)


pytestmark = pytest.mark.anyio
OWNER_ID = UUID("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")
SESSION_ID = UUID("99999999-8888-4777-8666-555555555555")
NOW = datetime(2026, 8, 24, 16, 0, tzinfo=timezone.utc)


def row(
    number: int,
    row_key: str,
    app_id: str,
    data: dict,
    *,
    parent_id: str | None = None,
    status: str | None = None,
    deleted_at: int | None = None,
) -> SnapshotRow:
    return SnapshotRow(
        row_key=row_key,
        sync_id=UUID(f"00000000-0000-4000-8000-{number:012d}"),
        app_id=app_id,
        parent_id=parent_id,
        position=0,
        status=status,
        searchable_name=data.get("name"),
        data_json=json.dumps(data, separators=(",", ":")),
        record_hash=f"{number:08x}",
        deleted_at=deleted_at,
    )


def snapshot_tables() -> SnapshotTables:
    return SnapshotTables(
        preferences=[row(1, "preferences:owner", "owner", {
            "preferences": {"weeklyWorkoutGoal": 3, "weightUnit": "lb"},
            "restTimerSettings": {"defaultSeconds": 120},
        })],
        exercises=[row(2, "exercise:bench", "bench", {
            "id": "bench",
            "name": "Bench Press",
            "exerciseType": "Weight & Reps",
            "primaryMuscle": "Chest",
            "equipment": "Barbell",
        })],
        workout_folders=[row(3, "folder:upper", "upper", {"id": "upper", "name": "Upper / Lower"})],
        workout_templates=[row(4, "template:upper-a", "upper-a", {
            "id": "upper-a",
            "name": "Upper A",
            "folder": "Upper / Lower",
            "detail": "1 exercise · 1 planned set",
        })],
        workout_sessions=[row(5, "session:workout-1", "workout-1", {
            "id": "workout-1",
            "name": "Upper A",
            "startedAt": 1_777_000_000_000,
            "completedAt": 1_777_000_300_000,
            "sourceTemplateId": "upper-a",
        }, status="completed")],
        workout_exercises=[row(6, "session:workout-1:exercise:bench-1", "bench-1", {
            "id": "bench-1",
            "exerciseDefinitionId": "bench",
            "name": "Bench Press",
            "exerciseType": "Weight & Reps",
            "supersetId": "superset-a",
        }, parent_id="session:workout-1")],
        workout_sets=[row(7, "session:workout-1:exercise:bench-1:set:set-1", "set-1", {
            "id": "set-1",
            "weight": 205,
            "reps": 5,
            "setType": "normal",
            "completed": True,
        }, parent_id="session:workout-1:exercise:bench-1")],
    )


class FakeWorkoutDataService:
    def __init__(self) -> None:
        self.tables = snapshot_tables()
        self.last_request: SnapshotWriteRequest | None = None

    async def summary(self, _owner_id: UUID) -> DataSummaryResponse:
        return DataSummaryResponse(
            initialized=True,
            revision=1,
            storage_version=12,
            projection_hash="deadbeef",
            updated_at=NOW,
            row_count=self.tables.row_count,
            counts=self.counts(),
        )

    async def load_snapshot(self, owner_id: UUID) -> SnapshotResponse:
        return SnapshotResponse(
            owner_id=owner_id,
            revision=1,
            storage_version=12,
            projection_hash="deadbeef",
            updated_at=NOW,
            row_count=self.tables.row_count,
            counts=self.counts(),
            tables=self.tables,
        )

    async def replace_snapshot(self, owner_id: UUID, request: SnapshotWriteRequest) -> SnapshotWriteResponse:
        self.last_request = request
        return SnapshotWriteResponse(
            owner_id=owner_id,
            revision=2,
            storage_version=request.storage_version,
            projection_hash=request.projection_hash,
            updated_at=NOW,
            row_count=request.tables.row_count,
            counts=self.counts(),
        )

    def counts(self) -> SnapshotCounts:
        return SnapshotCounts(
            preferences=1,
            exercises=1,
            folders=1,
            templates=1,
            sessions=1,
            workout_exercises=1,
            workout_sets=1,
        )


@pytest.fixture
def fake_data(application: FastAPI) -> FakeWorkoutDataService:
    service = FakeWorkoutDataService()
    principal = AuthenticatedOwner(
        owner=SimpleNamespace(id=OWNER_ID),
        session_id=SESSION_ID,
    )
    application.dependency_overrides[require_authenticated_owner] = lambda: principal
    application.dependency_overrides[get_workout_data_service] = lambda: service
    return service


async def test_snapshot_routes_require_owner_authentication(client: AsyncClient) -> None:
    response = await client.get("/api/v1/data/summary")

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "authentication_required"


async def test_owner_can_read_snapshot_summary(client: AsyncClient, fake_data: FakeWorkoutDataService) -> None:
    response = await client.get("/api/v1/data/summary")

    assert response.status_code == 200
    assert response.json()["revision"] == 1
    assert response.json()["counts"]["workoutSets"] == 1


async def test_snapshot_round_trip_preserves_normalized_relationship_keys(
    client: AsyncClient,
    fake_data: FakeWorkoutDataService,
) -> None:
    response = await client.get("/api/v1/data/snapshot")

    assert response.status_code == 200
    payload = response.json()
    assert payload["tables"]["workout_sessions"][0]["status"] == "completed"
    assert payload["tables"]["workout_exercises"][0]["parentId"] == "session:workout-1"
    assert payload["tables"]["workout_sets"][0]["dataJson"].endswith('"completed":true}')


async def test_owner_can_transactionally_replace_snapshot(
    client: AsyncClient,
    fake_data: FakeWorkoutDataService,
) -> None:
    tables = fake_data.tables.model_dump(mode="json", by_alias=True)
    response = await client.put(
        "/api/v1/data/snapshot",
        headers={"Authorization": "Bearer lf_at_test"},
        json={
            "storageVersion": 12,
            "projectionHash": "deadbeef",
            "baseRevision": 1,
            "tables": tables,
        },
    )

    assert response.status_code == 200
    assert response.json()["revision"] == 2
    assert fake_data.last_request is not None
    assert fake_data.last_request.base_revision == 1


def test_relationship_validation_rejects_an_orphaned_set() -> None:
    tables = snapshot_tables()
    tables.workout_sets[0].parent_id = "session:missing:exercise:missing"

    with pytest.raises(Exception) as error:
        validate_snapshot_relationships(tables)

    assert getattr(error.value, "detail")["code"] == "missing_set_parent"


def test_server_projection_hash_matches_the_typescript_client_algorithm() -> None:
    assert projection_hash_for_tables(snapshot_tables()) == "d07b5e83"


async def test_snapshot_rejects_an_unsupported_mobile_storage_version() -> None:
    service = WorkoutDataService(
        session=None,  # type: ignore[arg-type]
        settings=Settings(_env_file=None, environment="test", postgres_password="test-password"),
    )
    request = SnapshotWriteRequest(
        storage_version=11,
        projection_hash="deadbeef",
        tables=snapshot_tables(),
    )

    with pytest.raises(HTTPException) as error:
        await service.replace_snapshot(OWNER_ID, request)

    assert error.value.status_code == 409
    assert error.value.detail["code"] == "storage_version_mismatch"


class FakeTransaction:
    async def __aenter__(self) -> None:
        return None

    async def __aexit__(self, *_args: object) -> None:
        return None


class FakeStateResult:
    def scalar_one_or_none(self) -> SimpleNamespace:
        return SimpleNamespace(revision=3)


class FakeRevisionSession:
    def begin(self) -> FakeTransaction:
        return FakeTransaction()

    async def execute(self, _statement: object) -> FakeStateResult:
        return FakeStateResult()


async def test_snapshot_rejects_a_stale_base_revision_before_writing() -> None:
    tables = snapshot_tables()
    service = WorkoutDataService(
        session=FakeRevisionSession(),  # type: ignore[arg-type]
        settings=Settings(_env_file=None, environment="test", postgres_password="test-password"),
    )
    request = SnapshotWriteRequest(
        storage_version=12,
        projection_hash=projection_hash_for_tables(tables),
        base_revision=2,
        tables=tables,
    )

    with pytest.raises(HTTPException) as error:
        await service.replace_snapshot(OWNER_ID, request)

    assert error.value.status_code == 409
    assert error.value.detail["code"] == "snapshot_revision_conflict"


async def test_snapshot_rejects_a_projection_hash_that_does_not_match_rows() -> None:
    service = WorkoutDataService(
        session=None,  # type: ignore[arg-type]
        settings=Settings(_env_file=None, environment="test", postgres_password="test-password"),
    )
    request = SnapshotWriteRequest(
        storage_version=12,
        projection_hash="deadbeef",
        tables=snapshot_tables(),
    )

    with pytest.raises(HTTPException) as error:
        await service.replace_snapshot(OWNER_ID, request)

    assert error.value.status_code == 422
    assert error.value.detail["code"] == "projection_hash_mismatch"
