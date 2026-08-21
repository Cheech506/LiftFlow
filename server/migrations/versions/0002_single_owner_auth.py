"""Add the single-owner account and refreshable device sessions.

Revision ID: 0002_single_owner_auth
Revises: 0001_server_foundation
Create Date: 2026-08-19
"""
from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "0002_single_owner_auth"
down_revision: str | None = "0001_server_foundation"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "owner_accounts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("singleton_key", sa.SmallInteger(), server_default=sa.text("1"), nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("username_normalized", sa.String(length=50), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("singleton_key = 1", name="ck_owner_accounts_singleton"),
        sa.CheckConstraint("char_length(username) BETWEEN 3 AND 50", name="ck_owner_accounts_username_length"),
        sa.CheckConstraint("char_length(display_name) BETWEEN 1 AND 100", name="ck_owner_accounts_display_name_length"),
        sa.PrimaryKeyConstraint("id", name="pk_owner_accounts"),
        sa.UniqueConstraint("singleton_key", name="uq_owner_accounts_singleton_key"),
        sa.UniqueConstraint("username_normalized", name="uq_owner_accounts_username_normalized"),
    )
    op.create_table(
        "device_sessions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("device_name", sa.String(length=100), nullable=False),
        sa.Column("access_token_digest", sa.String(length=64), nullable=False),
        sa.Column("refresh_token_digest", sa.String(length=64), nullable=False),
        sa.Column("access_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("refresh_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["owner_accounts.id"],
            name="fk_device_sessions_owner_id_owner_accounts",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_device_sessions"),
        sa.UniqueConstraint("access_token_digest", name="uq_device_sessions_access_token_digest"),
        sa.UniqueConstraint("refresh_token_digest", name="uq_device_sessions_refresh_token_digest"),
    )
    op.create_index("ix_device_sessions_owner_id", "device_sessions", ["owner_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_device_sessions_owner_id", table_name="device_sessions")
    op.drop_table("device_sessions")
    op.drop_table("owner_accounts")
