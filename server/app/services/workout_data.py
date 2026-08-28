import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.models.owner_account import OwnerAccount
from app.models.workout_data import (
    ExerciseDefinition,
    OwnerDataState,
    OwnerPreference,
    WorkoutExercise,
    WorkoutFolder,
    WorkoutSession,
    WorkoutSet,
    WorkoutTemplate,
)
from app.schemas.workout_data import (
    DataSummaryResponse,
    ParsedSnapshot,
    SnapshotCounts,
    SnapshotResponse,
    SnapshotRow,
    SnapshotTables,
    SnapshotWriteRequest,
    SnapshotWriteResponse,
)


def data_error(code: str, message: str, status_code: int = status.HTTP_422_UNPROCESSABLE_CONTENT) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


def validate_snapshot_relationships(tables: SnapshotTables) -> ParsedSnapshot:
    if len(tables.preferences) != 1:
        raise data_error("invalid_preferences", "A LiftFlow snapshot must contain exactly one preference row.")

    parsed: ParsedSnapshot = {}
    for table_name, rows in tables.as_mapping().items():
        seen_sync_ids: set[UUID] = set()
        seen_row_keys: set[str] = set()
        seen_app_ids: set[str] = set()
        table_rows: list[tuple[SnapshotRow, dict[str, Any]]] = []
        for row in rows:
            if row.sync_id in seen_sync_ids or row.row_key in seen_row_keys:
                raise data_error(
                    "duplicate_snapshot_identity",
                    f"{table_name} contains a duplicate syncId or rowKey.",
                )
            seen_sync_ids.add(row.sync_id)
            seen_row_keys.add(row.row_key)
            if table_name in {
                "preferences",
                "exercises",
                "workout_folders",
                "workout_templates",
                "workout_sessions",
            }:
                if row.app_id in seen_app_ids:
                    raise data_error(
                        "duplicate_snapshot_app_id",
                        f"{table_name} contains a duplicate appId.",
                    )
                seen_app_ids.add(row.app_id)
            table_rows.append((row, json.loads(row.data_json)))
        parsed[table_name] = table_rows

    templates = {row.app_id for row, _ in parsed["workout_templates"]}
    sessions = {row.app_id for row, _ in parsed["workout_sessions"]}
    exercise_rows = {row.row_key for row, _ in parsed["workout_exercises"]}
    active_sessions = 0

    for row, _ in parsed["workout_sessions"]:
        if row.status not in {"active", "incomplete", "completed", "deleted"}:
            raise data_error("invalid_session_status", f"Workout session {row.app_id} has an invalid status.")
        if row.status == "active":
            active_sessions += 1
        if row.status == "deleted" and row.deleted_at is None:
            raise data_error("missing_deleted_timestamp", f"Deleted workout {row.app_id} has no deletedAt value.")
    if active_sessions > 1:
        raise data_error("multiple_active_workouts", "A snapshot may contain only one active workout.")

    for row, _ in parsed["workout_exercises"]:
        parent = row.parent_id or ""
        if parent.startswith("template:") and parent.removeprefix("template:") in templates:
            continue
        if parent.startswith("session:") and parent.removeprefix("session:") in sessions:
            continue
        raise data_error("missing_exercise_parent", f"Workout exercise {row.app_id} has no matching parent.")

    for row, _ in parsed["workout_sets"]:
        if row.parent_id not in exercise_rows:
            raise data_error("missing_set_parent", f"Workout set {row.app_id} has no matching exercise.")

    return parsed


class WorkoutDataService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.settings = settings

    async def summary(self, owner_id: UUID) -> DataSummaryResponse:
        state = await self.session.get(OwnerDataState, owner_id)
        if state is None:
            return DataSummaryResponse(
                initialized=False,
                revision=0,
                storage_version=None,
                projection_hash=None,
                updated_at=None,
                row_count=0,
                counts=SnapshotCounts(),
            )
        counts = await self._counts(owner_id)
        return DataSummaryResponse(
            initialized=True,
            revision=state.revision,
            storage_version=state.storage_version,
            projection_hash=state.projection_hash,
            updated_at=state.updated_at,
            row_count=state.row_count,
            counts=counts,
        )

    async def load_snapshot(self, owner_id: UUID) -> SnapshotResponse:
        state = await self.session.get(OwnerDataState, owner_id)
        if state is None:
            raise data_error(
                "server_data_empty",
                "This LiftFlow server does not have a workout snapshot yet.",
                status.HTTP_404_NOT_FOUND,
            )
        tables = SnapshotTables(
            preferences=await self._load_rows(OwnerPreference, owner_id),
            exercises=await self._load_rows(ExerciseDefinition, owner_id),
            workout_folders=await self._load_rows(WorkoutFolder, owner_id),
            workout_templates=await self._load_rows(WorkoutTemplate, owner_id),
            workout_sessions=await self._load_rows(WorkoutSession, owner_id),
            workout_exercises=await self._load_rows(WorkoutExercise, owner_id),
            workout_sets=await self._load_rows(WorkoutSet, owner_id),
        )
        return SnapshotResponse(
            owner_id=owner_id,
            revision=state.revision,
            storage_version=state.storage_version,
            projection_hash=state.projection_hash,
            updated_at=state.updated_at,
            row_count=state.row_count,
            counts=counts_for_tables(tables),
            tables=tables,
        )

    async def replace_snapshot(self, owner_id: UUID, request: SnapshotWriteRequest) -> SnapshotWriteResponse:
        if request.storage_version != self.settings.mobile_storage_version:
            raise data_error(
                "storage_version_mismatch",
                f"This server requires LiftFlow storage version {self.settings.mobile_storage_version}.",
                status.HTTP_409_CONFLICT,
            )
        parsed = validate_snapshot_relationships(request.tables)
        calculated_hash = projection_hash_for_tables(request.tables)
        if request.projection_hash != calculated_hash:
            raise data_error(
                "projection_hash_mismatch",
                f"Snapshot content hashes to {calculated_hash}, not {request.projection_hash}.",
            )

        async with self.session.begin():
            await self.session.execute(
                select(OwnerAccount.id).where(OwnerAccount.id == owner_id).with_for_update(),
            )
            state_result = await self.session.execute(
                select(OwnerDataState).where(OwnerDataState.owner_id == owner_id).with_for_update(),
            )
            state = state_result.scalar_one_or_none()
            current_revision = state.revision if state else 0
            if request.base_revision is not None and request.base_revision != current_revision:
                raise data_error(
                    "snapshot_revision_conflict",
                    f"Server data is at revision {current_revision}; refresh before replacing it.",
                    status.HTTP_409_CONFLICT,
                )

            await self._delete_owner_rows(owner_id)
            await self._insert_snapshot(owner_id, parsed)

            next_revision = current_revision + 1
            if state is None:
                state = OwnerDataState(
                    owner_id=owner_id,
                    revision=next_revision,
                    storage_version=request.storage_version,
                    projection_hash=request.projection_hash,
                    row_count=request.tables.row_count,
                )
                self.session.add(state)
            else:
                state.revision = next_revision
                state.storage_version = request.storage_version
                state.projection_hash = request.projection_hash
                state.row_count = request.tables.row_count
                state.updated_at = datetime.now(timezone.utc)

        await self.session.refresh(state)
        return SnapshotWriteResponse(
            owner_id=owner_id,
            revision=state.revision,
            storage_version=state.storage_version,
            projection_hash=state.projection_hash,
            updated_at=state.updated_at,
            row_count=state.row_count,
            counts=counts_for_tables(request.tables),
        )

    async def _delete_owner_rows(self, owner_id: UUID) -> None:
        for model in (
            WorkoutSet,
            WorkoutExercise,
            WorkoutSession,
            WorkoutTemplate,
            WorkoutFolder,
            ExerciseDefinition,
            OwnerPreference,
        ):
            await self.session.execute(delete(model).where(model.owner_id == owner_id))

    async def _insert_snapshot(self, owner_id: UUID, parsed: ParsedSnapshot) -> None:
        folder_names: dict[str, UUID] = {}
        template_ids: dict[str, UUID] = {}
        session_ids: dict[str, UUID] = {}
        definition_ids: dict[str, UUID] = {}
        exercise_ids: dict[str, UUID] = {}

        preference_row, preference_data = parsed["preferences"][0]
        self.session.add(OwnerPreference(id=uuid4(), owner_id=owner_id, **base_values(preference_row, preference_data)))

        for row, data in parsed["exercises"]:
            record_id = uuid4()
            definition_ids[row.app_id] = record_id
            self.session.add(ExerciseDefinition(
                id=record_id,
                owner_id=owner_id,
                name=required_string(data, "name", row.searchable_name or row.app_id),
                exercise_type=required_string(data, "exerciseType", "Weight & Reps"),
                primary_muscle=optional_string(data, "primaryMuscle"),
                equipment=optional_string(data, "equipment"),
                archived=bool(data.get("archived", False)),
                favorite=bool(data.get("favorite", False)),
                **base_values(row, data),
            ))

        for row, data in parsed["workout_folders"]:
            record_id = uuid4()
            name = required_string(data, "name", row.searchable_name or row.app_id)
            folder_names[name.strip().casefold()] = record_id
            self.session.add(WorkoutFolder(
                id=record_id,
                owner_id=owner_id,
                name=name,
                archived=bool(data.get("archived", False)),
                **base_values(row, data),
            ))

        for row, data in parsed["workout_templates"]:
            record_id = uuid4()
            template_ids[row.app_id] = record_id
            folder_name = optional_string(data, "folder")
            self.session.add(WorkoutTemplate(
                id=record_id,
                owner_id=owner_id,
                folder_id=folder_names.get(folder_name.strip().casefold()) if folder_name else None,
                name=required_string(data, "name", row.searchable_name or row.app_id),
                archived=bool(data.get("archived", False)),
                **base_values(row, data),
            ))

        for row, data in parsed["workout_sessions"]:
            record_id = uuid4()
            session_ids[row.app_id] = record_id
            source_template = optional_string(data, "sourceTemplateId")
            self.session.add(WorkoutSession(
                id=record_id,
                owner_id=owner_id,
                source_template_id=template_ids.get(source_template) if source_template else None,
                name=required_string(data, "name", row.searchable_name or row.app_id),
                started_at_ms=required_int(data, "startedAt"),
                completed_at_ms=optional_int(data, "completedAt"),
                saved_at_ms=optional_int(data, "savedAt"),
                import_source=optional_string(data, "importSource"),
                import_batch_id=optional_string(data, "importBatchId"),
                import_fingerprint=optional_string(data, "importFingerprint"),
                imported_at_ms=optional_int(data, "importedAt"),
                duration_unknown=bool(data.get("durationUnknown", False)),
                **base_values(row, data),
            ))

        for row, data in parsed["workout_exercises"]:
            record_id = uuid4()
            exercise_ids[row.row_key] = record_id
            parent_key = row.parent_id or ""
            template_id = template_ids.get(parent_key.removeprefix("template:")) if parent_key.startswith("template:") else None
            session_id = session_ids.get(parent_key.removeprefix("session:")) if parent_key.startswith("session:") else None
            definition_app_id = optional_string(data, "exerciseDefinitionId")
            self.session.add(WorkoutExercise(
                id=record_id,
                owner_id=owner_id,
                template_id=template_id,
                session_id=session_id,
                exercise_definition_id=definition_ids.get(definition_app_id) if definition_app_id else None,
                name=required_string(data, "name", row.searchable_name or row.app_id),
                exercise_type=required_string(data, "exerciseType", "Weight & Reps"),
                rest_seconds=optional_int(data, "restSeconds"),
                notes=optional_string(data, "notes") or "",
                superset_key=optional_string(data, "supersetId"),
                **base_values(row, data),
            ))

        for row, data in parsed["workout_sets"]:
            self.session.add(WorkoutSet(
                id=uuid4(),
                owner_id=owner_id,
                workout_exercise_id=exercise_ids[row.parent_id or ""],
                weight=optional_decimal(data, "weight"),
                reps=optional_decimal(data, "reps"),
                duration_seconds=optional_int(data, "durationSeconds"),
                distance=optional_decimal(data, "distance"),
                rpe=optional_decimal(data, "rpe"),
                rir=optional_decimal(data, "rir"),
                set_type=optional_string(data, "setType") or "normal",
                completed=bool(data.get("completed", False)),
                **base_values(row, data),
            ))

    async def _load_rows(self, model: type, owner_id: UUID) -> list[SnapshotRow]:
        result = await self.session.execute(
            select(model).where(model.owner_id == owner_id).order_by(model.position, model.row_key),
        )
        return [row_from_model(record) for record in result.scalars()]

    async def _counts(self, owner_id: UUID) -> SnapshotCounts:
        return SnapshotCounts(
            preferences=await self._count_rows(OwnerPreference, owner_id),
            exercises=await self._count_rows(ExerciseDefinition, owner_id),
            folders=await self._count_rows(WorkoutFolder, owner_id),
            templates=await self._count_rows(WorkoutTemplate, owner_id),
            sessions=await self._count_rows(WorkoutSession, owner_id),
            workout_exercises=await self._count_rows(WorkoutExercise, owner_id),
            workout_sets=await self._count_rows(WorkoutSet, owner_id),
        )

    async def _count_rows(self, model: type, owner_id: UUID) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(model).where(model.owner_id == owner_id),
        )
        return int(result.scalar_one())


def base_values(row: SnapshotRow, data: dict[str, Any]) -> dict[str, Any]:
    return {
        "sync_id": row.sync_id,
        "row_key": row.row_key,
        "app_id": row.app_id,
        "parent_key": row.parent_id,
        "position": row.position,
        "status": row.status,
        "searchable_name": row.searchable_name,
        "data_json_text": row.data_json,
        "data_json": data,
        "record_hash": row.record_hash,
        "deleted_at_ms": row.deleted_at,
    }


def row_from_model(record: Any) -> SnapshotRow:
    return SnapshotRow(
        row_key=record.row_key,
        sync_id=record.sync_id,
        app_id=record.app_id,
        parent_id=record.parent_key,
        position=record.position,
        status=record.status,
        searchable_name=record.searchable_name,
        data_json=record.data_json_text,
        record_hash=record.record_hash,
        deleted_at=record.deleted_at_ms,
    )


def counts_for_tables(tables: SnapshotTables) -> SnapshotCounts:
    return SnapshotCounts(
        preferences=len(tables.preferences),
        exercises=len(tables.exercises),
        folders=len(tables.workout_folders),
        templates=len(tables.workout_templates),
        sessions=len(tables.workout_sessions),
        workout_exercises=len(tables.workout_exercises),
        workout_sets=len(tables.workout_sets),
    )


def projection_hash_for_tables(tables: SnapshotTables) -> str:
    identity = "|".join(sorted(
        f"{table_name}:{row.row_key}:{row.record_hash}"
        for table_name, rows in tables.as_mapping().items()
        for row in rows
    ))
    value = 0x811C9DC5
    encoded = identity.encode("utf-16-le")
    for index in range(0, len(encoded), 2):
        value ^= int.from_bytes(encoded[index:index + 2], "little")
        value = (value * 0x01000193) & 0xFFFFFFFF
    return f"{value:08x}"


def required_string(data: dict[str, Any], key: str, fallback: str | None = None) -> str:
    value = data.get(key, fallback)
    if not isinstance(value, str) or not value.strip():
        raise data_error("invalid_snapshot_payload", f"{key} must be a non-empty string.")
    return value.strip()


def optional_string(data: dict[str, Any], key: str) -> str | None:
    value = data.get(key)
    return value if isinstance(value, str) and value else None


def required_int(data: dict[str, Any], key: str) -> int:
    value = optional_int(data, key)
    if value is None:
        raise data_error("invalid_snapshot_payload", f"{key} must be a non-negative integer.")
    return value


def optional_int(data: dict[str, Any], key: str) -> int | None:
    value = data.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0:
        return None
    return int(value)


def optional_decimal(data: dict[str, Any], key: str) -> Decimal | None:
    value = data.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return Decimal(str(value))
