from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class OwnerDataState(Base):
    __tablename__ = "owner_data_states"

    owner_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("owner_accounts.id", ondelete="CASCADE"),
        primary_key=True,
    )
    revision: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default=text("0"))
    storage_version: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    projection_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class SyncRowMixin:
    id: Mapped[UUID] = mapped_column(
        Uuid,
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    owner_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("owner_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sync_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    row_key: Mapped[str] = mapped_column(String(255), nullable=False)
    app_id: Mapped[str] = mapped_column(String(255), nullable=False)
    parent_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    searchable_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    data_json_text: Mapped[str] = mapped_column(Text, nullable=False)
    data_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    record_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    deleted_at_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class OwnerPreference(SyncRowMixin, Base):
    __tablename__ = "owner_preferences"
    __table_args__ = (
        UniqueConstraint("owner_id", name="uq_owner_preferences_owner_id"),
        UniqueConstraint("owner_id", "sync_id", name="uq_owner_preferences_owner_sync_id"),
        UniqueConstraint("owner_id", "row_key", name="uq_owner_preferences_owner_row_key"),
    )


class ExerciseDefinition(SyncRowMixin, Base):
    __tablename__ = "exercise_definitions"
    __table_args__ = (
        UniqueConstraint("owner_id", "sync_id", name="uq_exercise_definitions_owner_sync_id"),
        UniqueConstraint("owner_id", "row_key", name="uq_exercise_definitions_owner_row_key"),
        UniqueConstraint("owner_id", "app_id", name="uq_exercise_definitions_owner_app_id"),
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    exercise_type: Mapped[str] = mapped_column(String(64), nullable=False)
    primary_muscle: Mapped[str | None] = mapped_column(String(100), nullable=True)
    equipment: Mapped[str | None] = mapped_column(String(100), nullable=True)
    archived: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))


class WorkoutFolder(SyncRowMixin, Base):
    __tablename__ = "workout_folders"
    __table_args__ = (
        UniqueConstraint("owner_id", "sync_id", name="uq_workout_folders_owner_sync_id"),
        UniqueConstraint("owner_id", "row_key", name="uq_workout_folders_owner_row_key"),
        UniqueConstraint("owner_id", "app_id", name="uq_workout_folders_owner_app_id"),
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    archived: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))


class WorkoutTemplate(SyncRowMixin, Base):
    __tablename__ = "workout_templates"
    __table_args__ = (
        UniqueConstraint("owner_id", "sync_id", name="uq_workout_templates_owner_sync_id"),
        UniqueConstraint("owner_id", "row_key", name="uq_workout_templates_owner_row_key"),
        UniqueConstraint("owner_id", "app_id", name="uq_workout_templates_owner_app_id"),
    )

    folder_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("workout_folders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    archived: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))


class WorkoutSession(SyncRowMixin, Base):
    __tablename__ = "workout_sessions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'incomplete', 'completed', 'deleted')",
            name="ck_workout_sessions_status",
        ),
        UniqueConstraint("owner_id", "sync_id", name="uq_workout_sessions_owner_sync_id"),
        UniqueConstraint("owner_id", "row_key", name="uq_workout_sessions_owner_row_key"),
        UniqueConstraint("owner_id", "app_id", name="uq_workout_sessions_owner_app_id"),
    )

    source_template_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("workout_templates.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    started_at_ms: Mapped[int] = mapped_column(BigInteger, nullable=False)
    completed_at_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    saved_at_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    import_source: Mapped[str | None] = mapped_column(String(32), nullable=True)
    import_batch_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    import_fingerprint: Mapped[str | None] = mapped_column(String(255), nullable=True)
    imported_at_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    duration_unknown: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))


class WorkoutExercise(SyncRowMixin, Base):
    __tablename__ = "workout_exercises"
    __table_args__ = (
        CheckConstraint(
            "num_nonnulls(template_id, session_id) = 1",
            name="ck_workout_exercises_one_parent",
        ),
        UniqueConstraint("owner_id", "sync_id", name="uq_workout_exercises_owner_sync_id"),
        UniqueConstraint("owner_id", "row_key", name="uq_workout_exercises_owner_row_key"),
    )

    template_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("workout_templates.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    session_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("workout_sessions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    exercise_definition_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("exercise_definitions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    exercise_type: Mapped[str] = mapped_column(String(64), nullable=False)
    rest_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))
    superset_key: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)


class WorkoutSet(SyncRowMixin, Base):
    __tablename__ = "workout_sets"
    __table_args__ = (
        UniqueConstraint("owner_id", "sync_id", name="uq_workout_sets_owner_sync_id"),
        UniqueConstraint("owner_id", "row_key", name="uq_workout_sets_owner_row_key"),
    )

    workout_exercise_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("workout_exercises.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    weight: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    reps: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    distance: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    rpe: Mapped[Decimal | None] = mapped_column(Numeric(4, 2), nullable=True)
    rir: Mapped[Decimal | None] = mapped_column(Numeric(4, 2), nullable=True)
    set_type: Mapped[str] = mapped_column(String(16), nullable=False, server_default=text("'normal'"))
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
