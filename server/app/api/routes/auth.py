from fastapi import APIRouter, Depends, status

from app.api.dependencies import AuthenticatedOwner, get_auth_service, require_authenticated_owner
from app.core.auth import AuthService
from app.schemas.api import (
    AuthStatusResponse,
    LoginRequest,
    LogoutResponse,
    OwnerResponse,
    RefreshRequest,
    SessionTokenResponse,
    SetupOwnerRequest,
)


router = APIRouter(prefix="/auth")


@router.get("/status", response_model=AuthStatusResponse)
async def auth_status(service: AuthService = Depends(get_auth_service)) -> AuthStatusResponse:
    return await service.status()


@router.post(
    "/setup",
    response_model=SessionTokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def setup_owner(
    request: SetupOwnerRequest,
    service: AuthService = Depends(get_auth_service),
) -> SessionTokenResponse:
    return await service.setup(request)


@router.post("/login", response_model=SessionTokenResponse)
async def login(
    request: LoginRequest,
    service: AuthService = Depends(get_auth_service),
) -> SessionTokenResponse:
    return await service.login(request)


@router.post("/refresh", response_model=SessionTokenResponse)
async def refresh(
    request: RefreshRequest,
    service: AuthService = Depends(get_auth_service),
) -> SessionTokenResponse:
    return await service.refresh(request)


@router.get("/me", response_model=OwnerResponse)
async def me(
    principal: AuthenticatedOwner = Depends(require_authenticated_owner),
) -> OwnerResponse:
    return OwnerResponse.model_validate(principal.owner)


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    principal: AuthenticatedOwner = Depends(require_authenticated_owner),
    service: AuthService = Depends(get_auth_service),
) -> LogoutResponse:
    await service.logout(principal.session_id)
    return LogoutResponse()
