"""Create the stable LiftFlow server identity.

Revision ID: 0001_server_foundation
Revises:
Create Date: 2026-08-19
"""
from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "0001_server_foundation"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "server_instances",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "char_length(display_name) BETWEEN 1 AND 100",
            name="ck_server_instances_display_name_length",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_server_instances"),
    )
    op.execute("INSERT INTO server_instances (display_name) VALUES ('LiftFlow')")


def downgrade() -> None:
    op.drop_table("server_instances")
