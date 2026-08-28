import json
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from app.schemas.api import ApiModel


class SnapshotRow(ApiModel):
    row_key: str = Field(min_length=1, max_length=255)
    sync_id: UUID
    app_id: str = Field(min_length=1, max_length=255)
    parent_id: str | None = Field(default=None, min_length=1, max_length=255)
    position: int = Field(default=0, ge=0, le=1_000_000)
    status: str | None = Field(default=None, min_length=1, max_length=32)
    searchable_name: str | None = Field(default=None, max_length=255)
    data_json: str = Field(min_length=2, max_length=1_000_000)
    record_hash: str = Field(pattern=r"^[0-9a-f]{8,64}$")
    deleted_at: int | None = Field(default=None, ge=0)

    @field_validator("data_json")
    @classmethod
    def require_json_object(cls, value: str) -> str:
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError as error:
            raise ValueError("must contain valid JSON") from error
        if not isinstance(parsed, dict):
            raise ValueError("must contain a JSON object")
        return value


class SnapshotTables(ApiModel):
    preferences: list[SnapshotRow] = Field(max_length=1)
    exercises: list[SnapshotRow] = Field(max_length=10_000)
    workout_folders: list[SnapshotRow] = Field(alias="workout_folders", max_length=1_000)
    workout_templates: list[SnapshotRow] = Field(alias="workout_templates", max_length=10_000)
    workout_sessions: list[SnapshotRow] = Field(alias="workout_sessions", max_length=50_000)
    workout_exercises: list[SnapshotRow] = Field(alias="workout_exercises", max_length=100_000)
    workout_sets: list[SnapshotRow] = Field(alias="workout_sets", max_length=500_000)

    @model_validator(mode="after")
    def limit_total_rows(self) -> "SnapshotTables":
        if self.row_count > 600_000:
            raise ValueError("snapshot contains too many rows")
        return self

    @property
    def row_count(self) -> int:
        return sum(len(rows) for rows in self.as_mapping().values())

    def as_mapping(self) -> dict[str, list[SnapshotRow]]:
        return {
            "preferences": self.preferences,
            "exercises": self.exercises,
            "workout_folders": self.workout_folders,
            "workout_templates": self.workout_templates,
            "workout_sessions": self.workout_sessions,
            "workout_exercises": self.workout_exercises,
            "workout_sets": self.workout_sets,
        }


class SnapshotWriteRequest(ApiModel):
    storage_version: int = Field(ge=1, le=32_767)
    projection_hash: str = Field(pattern=r"^[0-9a-f]{8,64}$")
    base_revision: int | None = Field(default=None, ge=0)
    tables: SnapshotTables


class SnapshotCounts(ApiModel):
    preferences: int = 0
    exercises: int = 0
    folders: int = 0
    templates: int = 0
    sessions: int = 0
    workout_exercises: int = 0
    workout_sets: int = 0


class DataSummaryResponse(ApiModel):
    initialized: bool
    revision: int
    storage_version: int | None
    projection_hash: str | None
    updated_at: datetime | None
    row_count: int
    counts: SnapshotCounts


class SnapshotWriteResponse(ApiModel):
    owner_id: UUID
    revision: int
    storage_version: int
    projection_hash: str
    updated_at: datetime
    row_count: int
    counts: SnapshotCounts


class SnapshotResponse(SnapshotWriteResponse):
    tables: SnapshotTables


ParsedSnapshot = dict[str, list[tuple[SnapshotRow, dict[str, Any]]]]
