"""Add owner-scoped relational workout storage and snapshot state.

Revision ID: 0003_workout_data
Revises: 0002_single_owner_auth
Create Date: 2026-08-24
"""
from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "0003_workout_data"
down_revision: str | None = "0002_single_owner_auth"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def sync_columns() -> list[sa.Column]:
    return [
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sync_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("row_key", sa.String(length=255), nullable=False),
        sa.Column("app_id", sa.String(length=255), nullable=False),
        sa.Column("parent_key", sa.String(length=255), nullable=True),
        sa.Column("position", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=True),
        sa.Column("searchable_name", sa.String(length=255), nullable=True),
        sa.Column("data_json_text", sa.Text(), nullable=False),
        sa.Column("data_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("record_hash", sa.String(length=64), nullable=False),
        sa.Column("deleted_at_ms", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    ]


def owner_fk(table_name: str) -> sa.ForeignKeyConstraint:
    return sa.ForeignKeyConstraint(
        ["owner_id"],
        ["owner_accounts.id"],
        name=f"fk_{table_name}_owner_id_owner_accounts",
        ondelete="CASCADE",
    )


def upgrade() -> None:
    op.create_table(
        "owner_data_states",
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("revision", sa.BigInteger(), server_default=sa.text("0"), nullable=False),
        sa.Column("storage_version", sa.SmallInteger(), nullable=False),
        sa.Column("projection_hash", sa.String(length=64), nullable=False),
        sa.Column("row_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["owner_accounts.id"],
            name="fk_owner_data_states_owner_id_owner_accounts",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("owner_id", name="pk_owner_data_states"),
    )
    op.create_table(
        "owner_preferences",
        *sync_columns(),
        owner_fk("owner_preferences"),
        sa.PrimaryKeyConstraint("id", name="pk_owner_preferences"),
        sa.UniqueConstraint("owner_id", name="uq_owner_preferences_owner_id"),
        sa.UniqueConstraint("owner_id", "sync_id", name="uq_owner_preferences_owner_sync_id"),
        sa.UniqueConstraint("owner_id", "row_key", name="uq_owner_preferences_owner_row_key"),
    )
    op.create_table(
        "exercise_definitions",
        *sync_columns(),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("exercise_type", sa.String(length=64), nullable=False),
        sa.Column("primary_muscle", sa.String(length=100), nullable=True),
        sa.Column("equipment", sa.String(length=100), nullable=True),
        sa.Column("archived", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("favorite", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        owner_fk("exercise_definitions"),
        sa.PrimaryKeyConstraint("id", name="pk_exercise_definitions"),
        sa.UniqueConstraint("owner_id", "sync_id", name="uq_exercise_definitions_owner_sync_id"),
        sa.UniqueConstraint("owner_id", "row_key", name="uq_exercise_definitions_owner_row_key"),
        sa.UniqueConstraint("owner_id", "app_id", name="uq_exercise_definitions_owner_app_id"),
    )
    op.create_table(
        "workout_folders",
        *sync_columns(),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("archived", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        owner_fk("workout_folders"),
        sa.PrimaryKeyConstraint("id", name="pk_workout_folders"),
        sa.UniqueConstraint("owner_id", "sync_id", name="uq_workout_folders_owner_sync_id"),
        sa.UniqueConstraint("owner_id", "row_key", name="uq_workout_folders_owner_row_key"),
        sa.UniqueConstraint("owner_id", "app_id", name="uq_workout_folders_owner_app_id"),
    )
    op.create_table(
        "workout_templates",
        *sync_columns(),
        sa.Column("folder_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("archived", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        owner_fk("workout_templates"),
        sa.ForeignKeyConstraint(
            ["folder_id"],
            ["workout_folders.id"],
            name="fk_workout_templates_folder_id_workout_folders",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_workout_templates"),
        sa.UniqueConstraint("owner_id", "sync_id", name="uq_workout_templates_owner_sync_id"),
        sa.UniqueConstraint("owner_id", "row_key", name="uq_workout_templates_owner_row_key"),
        sa.UniqueConstraint("owner_id", "app_id", name="uq_workout_templates_owner_app_id"),
    )
    op.create_index("ix_workout_templates_folder_id", "workout_templates", ["folder_id"])
    op.create_table(
        "workout_sessions",
        *sync_columns(),
        sa.Column("source_template_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("started_at_ms", sa.BigInteger(), nullable=False),
        sa.Column("completed_at_ms", sa.BigInteger(), nullable=True),
        sa.Column("saved_at_ms", sa.BigInteger(), nullable=True),
        sa.Column("import_source", sa.String(length=32), nullable=True),
        sa.Column("import_batch_id", sa.String(length=255), nullable=True),
        sa.Column("import_fingerprint", sa.String(length=255), nullable=True),
        sa.Column("imported_at_ms", sa.BigInteger(), nullable=True),
        sa.Column("duration_unknown", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        owner_fk("workout_sessions"),
        sa.ForeignKeyConstraint(
            ["source_template_id"],
            ["workout_templates.id"],
            name="fk_workout_sessions_source_template_id_workout_templates",
            ondelete="SET NULL",
        ),
        sa.CheckConstraint(
            "status IN ('active', 'incomplete', 'completed', 'deleted')",
            name="ck_workout_sessions_status",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_workout_sessions"),
        sa.UniqueConstraint("owner_id", "sync_id", name="uq_workout_sessions_owner_sync_id"),
        sa.UniqueConstraint("owner_id", "row_key", name="uq_workout_sessions_owner_row_key"),
        sa.UniqueConstraint("owner_id", "app_id", name="uq_workout_sessions_owner_app_id"),
    )
    op.create_index("ix_workout_sessions_source_template_id", "workout_sessions", ["source_template_id"])
    op.create_index("ix_workout_sessions_import_batch_id", "workout_sessions", ["import_batch_id"])
    op.create_table(
        "workout_exercises",
        *sync_columns(),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("exercise_definition_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("exercise_type", sa.String(length=64), nullable=False),
        sa.Column("rest_seconds", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.Column("superset_key", sa.String(length=255), nullable=True),
        owner_fk("workout_exercises"),
        sa.ForeignKeyConstraint(
            ["template_id"],
            ["workout_templates.id"],
            name="fk_workout_exercises_template_id_workout_templates",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["workout_sessions.id"],
            name="fk_workout_exercises_session_id_workout_sessions",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["exercise_definition_id"],
            ["exercise_definitions.id"],
            name="fk_workout_exercises_definition_id_exercise_definitions",
            ondelete="SET NULL",
        ),
        sa.CheckConstraint(
            "num_nonnulls(template_id, session_id) = 1",
            name="ck_workout_exercises_one_parent",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_workout_exercises"),
        sa.UniqueConstraint("owner_id", "sync_id", name="uq_workout_exercises_owner_sync_id"),
        sa.UniqueConstraint("owner_id", "row_key", name="uq_workout_exercises_owner_row_key"),
    )
    op.create_index("ix_workout_exercises_template_id", "workout_exercises", ["template_id"])
    op.create_index("ix_workout_exercises_session_id", "workout_exercises", ["session_id"])
    op.create_index("ix_workout_exercises_exercise_definition_id", "workout_exercises", ["exercise_definition_id"])
    op.create_index("ix_workout_exercises_superset_key", "workout_exercises", ["superset_key"])
    op.create_table(
        "workout_sets",
        *sync_columns(),
        sa.Column("workout_exercise_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("weight", sa.Numeric(precision=12, scale=3), nullable=True),
        sa.Column("reps", sa.Numeric(precision=12, scale=3), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("distance", sa.Numeric(precision=12, scale=3), nullable=True),
        sa.Column("rpe", sa.Numeric(precision=4, scale=2), nullable=True),
        sa.Column("rir", sa.Numeric(precision=4, scale=2), nullable=True),
        sa.Column("set_type", sa.String(length=16), server_default=sa.text("'normal'"), nullable=False),
        sa.Column("completed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        owner_fk("workout_sets"),
        sa.ForeignKeyConstraint(
            ["workout_exercise_id"],
            ["workout_exercises.id"],
            name="fk_workout_sets_workout_exercise_id_workout_exercises",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_workout_sets"),
        sa.UniqueConstraint("owner_id", "sync_id", name="uq_workout_sets_owner_sync_id"),
        sa.UniqueConstraint("owner_id", "row_key", name="uq_workout_sets_owner_row_key"),
    )
    op.create_index("ix_workout_sets_workout_exercise_id", "workout_sets", ["workout_exercise_id"])

    for table_name in (
        "owner_preferences",
        "exercise_definitions",
        "workout_folders",
        "workout_templates",
        "workout_sessions",
        "workout_exercises",
        "workout_sets",
    ):
        op.create_index(f"ix_{table_name}_owner_id", table_name, ["owner_id"])


def downgrade() -> None:
    op.drop_table("workout_sets")
    op.drop_table("workout_exercises")
    op.drop_table("workout_sessions")
    op.drop_table("workout_templates")
    op.drop_table("workout_folders")
    op.drop_table("exercise_definitions")
    op.drop_table("owner_preferences")
    op.drop_table("owner_data_states")
