from fastapi import APIRouter, Depends

from app.api.dependencies import load_server_identity, require_database
from app.core.config import Settings, get_settings
from app.schemas.api import ServerCapabilities, ServerIdentity, ServerInfoResponse


router = APIRouter()


@router.get("/server-info", response_model=ServerInfoResponse)
async def server_info(
    _: str = Depends(require_database),
    identity: ServerIdentity = Depends(load_server_identity),
    settings: Settings = Depends(get_settings),
) -> ServerInfoResponse:
    return ServerInfoResponse(
        server_id=identity.server_id,
        name=identity.display_name,
        server_version=settings.server_version,
        api_version=settings.api_version,
        minimum_client_version=settings.minimum_client_version,
        storage_version=settings.mobile_storage_version,
        environment=settings.environment,
        capabilities=ServerCapabilities(
            authentication=True,
            backup_import=False,
            sync=False,
            web_app=False,
        ),
    )
