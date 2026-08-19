from typing import Literal

from fastapi import Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import engine, get_session
from app.models.server_instance import ServerInstance
from app.schemas.api import ServerIdentity


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
