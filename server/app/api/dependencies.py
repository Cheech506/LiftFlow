from dataclasses import dataclass
from typing import Annotated, Literal
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import engine, get_session
from app.core.auth import AuthService, auth_error
from app.core.config import Settings, get_settings
from app.models.owner_account import OwnerAccount
from app.models.server_instance import ServerInstance
from app.schemas.api import ServerIdentity


bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthenticatedOwner:
    owner: OwnerAccount
    session_id: UUID


def get_auth_service(
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> AuthService:
    return AuthService(session, settings)


async def require_authenticated_owner(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    service: AuthService = Depends(get_auth_service),
) -> AuthenticatedOwner:
    if credentials is None or credentials.scheme.casefold() != "bearer":
        raise auth_error(
            "authentication_required",
            "Sign in to this LiftFlow server first.",
            status.HTTP_401_UNAUTHORIZED,
        )
    owner, device_session = await service.authenticate(credentials.credentials)
    return AuthenticatedOwner(owner=owner, session_id=device_session.id)


async def require_database() -> Literal["connected"]:
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "database_unavailable",
                "message": "LiftFlow could not reach PostgreSQL.",
            },
        ) from error
    return "connected"


async def load_server_identity(
    session: AsyncSession = Depends(get_session),
) -> ServerIdentity:
    try:
        result = await session.execute(
            select(ServerInstance).order_by(ServerInstance.created_at).limit(1),
        )
        instance = result.scalar_one_or_none()
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "database_unavailable",
                "message": "LiftFlow could not read its server identity.",
            },
        ) from error

    if instance is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "server_not_initialized",
                "message": "The LiftFlow database migration has not initialized this server.",
            },
        )
    return ServerIdentity(server_id=instance.id, display_name=instance.display_name)
