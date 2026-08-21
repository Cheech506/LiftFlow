from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, SmallInteger, String, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class OwnerAccount(Base):
    __tablename__ = "owner_accounts"
    __table_args__ = (
        CheckConstraint("singleton_key = 1", name="ck_owner_accounts_singleton"),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid,
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    singleton_key: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
        unique=True,
        server_default=text("1"),
    )
    username: Mapped[str] = mapped_column(String(50), nullable=False)
    username_normalized: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
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
    sessions: Mapped[list["DeviceSession"]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan",
    )


class DeviceSession(Base):
    __tablename__ = "device_sessions"

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
    device_name: Mapped[str] = mapped_column(String(100), nullable=False)
    access_token_digest: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    refresh_token_digest: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    access_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    refresh_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    last_used_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    owner: Mapped[OwnerAccount] = relationship(back_populates="sessions")
