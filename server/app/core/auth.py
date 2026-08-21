import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.models.owner_account import DeviceSession, OwnerAccount
from app.models.server_instance import ServerInstance
from app.schemas.api import (
    AuthStatusResponse,
    LoginRequest,
    OwnerResponse,
    RefreshRequest,
    SessionTokenResponse,
    SetupOwnerRequest,
)


ACCESS_TOKEN_PREFIX = "lf_at_"
REFRESH_TOKEN_PREFIX = "lf_rt_"
password_hasher = PasswordHasher()
dummy_password_hash = password_hasher.hash("liftflow-invalid-password-sentinel")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_username(username: str) -> str:
    return username.strip().casefold()


def digest_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_token(prefix: str) -> str:
    return f"{prefix}{secrets.token_urlsafe(32)}"


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except (InvalidHashError, VerificationError, VerifyMismatchError):
        return False


def auth_error(code: str, message: str, status_code: int) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )


class AuthService:
    def __init__(self, session: AsyncSession, settings: Settings):
        self.session = session
        self.settings = settings

    async def status(self) -> AuthStatusResponse:
        owner = await self._load_owner()
        identity = await self._load_server_identity()
        return AuthStatusResponse(
            server_id=identity.id,
            server_name=identity.display_name,
            setup_required=owner is None,
        )

    async def setup(self, request: SetupOwnerRequest) -> SessionTokenResponse:
        if await self._load_owner() is not None:
            raise auth_error(
                "setup_already_complete",
                "This LiftFlow server already has its owner account.",
                status.HTTP_409_CONFLICT,
            )

        identity = await self._load_server_identity()
        identity.display_name = request.server_name
        owner = OwnerAccount(
            singleton_key=1,
            username=request.username,
            username_normalized=normalize_username(request.username),
            display_name=request.display_name,
            password_hash=hash_password(request.password.get_secret_value()),
        )
        self.session.add(owner)
        try:
            await self.session.flush()
            response = await self._create_session(owner, request.device_name)
            await self.session.commit()
            return response
        except IntegrityError as error:
            await self.session.rollback()
            raise auth_error(
                "setup_already_complete",
                "This LiftFlow server already has its owner account.",
                status.HTTP_409_CONFLICT,
            ) from error

    async def login(self, request: LoginRequest) -> SessionTokenResponse:
        owner = await self._load_owner(normalize_username(request.username))
        password = request.password.get_secret_value()
        if owner is None:
            verify_password(dummy_password_hash, password)
            raise self._invalid_credentials()
        if not verify_password(owner.password_hash, password):
            raise self._invalid_credentials()

        if password_hasher.check_needs_rehash(owner.password_hash):
            owner.password_hash = hash_password(password)
        response = await self._create_session(owner, request.device_name)
        await self.session.commit()
        return response

    async def refresh(self, request: RefreshRequest) -> SessionTokenResponse:
        if not request.refresh_token.startswith(REFRESH_TOKEN_PREFIX):
            raise self._invalid_session()
        result = await self.session.execute(
            select(DeviceSession, OwnerAccount)
            .join(OwnerAccount, DeviceSession.owner_id == OwnerAccount.id)
            .where(DeviceSession.refresh_token_digest == digest_token(request.refresh_token)),
        )
        row = result.one_or_none()
        if row is None:
            raise self._invalid_session()
        device_session, owner = row
        now = utc_now()
        if device_session.revoked_at is not None or device_session.refresh_expires_at <= now:
            raise self._invalid_session()

        access_token = new_token(ACCESS_TOKEN_PREFIX)
        refresh_token = new_token(REFRESH_TOKEN_PREFIX)
        device_session.access_token_digest = digest_token(access_token)
        device_session.refresh_token_digest = digest_token(refresh_token)
        device_session.access_expires_at = now + timedelta(minutes=self.settings.access_token_minutes)
        device_session.refresh_expires_at = now + timedelta(days=self.settings.refresh_token_days)
        device_session.last_used_at = now
        if request.device_name:
            device_session.device_name = request.device_name.strip()
        await self.session.commit()
        return self._token_response(owner, device_session, access_token, refresh_token)

    async def authenticate(self, access_token: str) -> tuple[OwnerAccount, DeviceSession]:
        if not access_token.startswith(ACCESS_TOKEN_PREFIX):
            raise self._invalid_session()
        result = await self.session.execute(
            select(OwnerAccount, DeviceSession)
            .join(DeviceSession, DeviceSession.owner_id == OwnerAccount.id)
            .where(DeviceSession.access_token_digest == digest_token(access_token)),
        )
        row = result.one_or_none()
        if row is None:
            raise self._invalid_session()
        owner, device_session = row
        now = utc_now()
        if device_session.revoked_at is not None or device_session.access_expires_at <= now:
            raise self._invalid_session()
        device_session.last_used_at = now
        await self.session.commit()
        return owner, device_session

    async def logout(self, session_id: UUID) -> None:
        result = await self.session.execute(
            select(DeviceSession).where(DeviceSession.id == session_id),
        )
        device_session = result.scalar_one_or_none()
        if device_session is not None and device_session.revoked_at is None:
            device_session.revoked_at = utc_now()
            await self.session.commit()

    async def _load_owner(self, normalized_username: str | None = None) -> OwnerAccount | None:
        query = select(OwnerAccount).order_by(OwnerAccount.created_at).limit(1)
        if normalized_username is not None:
            query = query.where(OwnerAccount.username_normalized == normalized_username)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def _load_server_identity(self) -> ServerInstance:
        result = await self.session.execute(
            select(ServerInstance).order_by(ServerInstance.created_at).limit(1),
        )
        identity = result.scalar_one_or_none()
        if identity is None:
            raise auth_error(
                "server_not_initialized",
                "The LiftFlow database migration has not initialized this server.",
                status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return identity

    async def _create_session(
        self,
        owner: OwnerAccount,
        device_name: str,
    ) -> SessionTokenResponse:
        now = utc_now()
        access_token = new_token(ACCESS_TOKEN_PREFIX)
        refresh_token = new_token(REFRESH_TOKEN_PREFIX)
        device_session = DeviceSession(
            owner_id=owner.id,
            device_name=device_name.strip(),
            access_token_digest=digest_token(access_token),
            refresh_token_digest=digest_token(refresh_token),
            access_expires_at=now + timedelta(minutes=self.settings.access_token_minutes),
            refresh_expires_at=now + timedelta(days=self.settings.refresh_token_days),
            last_used_at=now,
        )
        self.session.add(device_session)
        await self.session.flush()
        return self._token_response(owner, device_session, access_token, refresh_token)

    @staticmethod
    def _token_response(
        owner: OwnerAccount,
        device_session: DeviceSession,
        access_token: str,
        refresh_token: str,
    ) -> SessionTokenResponse:
        return SessionTokenResponse(
            access_token=access_token,
            access_expires_at=device_session.access_expires_at,
            refresh_token=refresh_token,
            refresh_expires_at=device_session.refresh_expires_at,
            owner=OwnerResponse.model_validate(owner),
        )

    @staticmethod
    def _invalid_credentials() -> HTTPException:
        return auth_error(
            "invalid_credentials",
            "The username or password is incorrect.",
            status.HTTP_401_UNAUTHORIZED,
        )

    @staticmethod
    def _invalid_session() -> HTTPException:
        return auth_error(
            "invalid_session",
            "This LiftFlow session is invalid or expired.",
            status.HTTP_401_UNAUTHORIZED,
        )
