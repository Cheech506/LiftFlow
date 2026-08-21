from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.api.dependencies import get_auth_service
from app.core.auth import ACCESS_TOKEN_PREFIX, REFRESH_TOKEN_PREFIX, digest_token, hash_password, new_token, verify_password
from app.schemas.api import AuthStatusResponse, OwnerResponse, SessionTokenResponse
from conftest import TEST_SERVER_ID


pytestmark = pytest.mark.anyio
OWNER_ID = UUID("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")
SESSION_ID = UUID("99999999-8888-4777-8666-555555555555")
NOW = datetime(2026, 8, 19, 15, 0, tzinfo=timezone.utc)


class FakeAuthService:
    def __init__(self) -> None:
        self.logged_out_session_id: UUID | None = None
        self.owner = SimpleNamespace(
            id=OWNER_ID,
            username="cheech",
            display_name="Corey",
            created_at=NOW,
        )

    async def status(self) -> AuthStatusResponse:
        return AuthStatusResponse(
            server_id=TEST_SERVER_ID,
            server_name="Home LiftFlow",
            setup_required=True,
        )

    async def setup(self, _request: object) -> SessionTokenResponse:
        return self.tokens()

    async def login(self, _request: object) -> SessionTokenResponse:
        return self.tokens()

    async def refresh(self, _request: object) -> SessionTokenResponse:
        return self.tokens()

    async def authenticate(self, _access_token: str) -> tuple[object, object]:
        return self.owner, SimpleNamespace(id=SESSION_ID)

    async def logout(self, session_id: UUID) -> None:
        self.logged_out_session_id = session_id

    def tokens(self) -> SessionTokenResponse:
        return SessionTokenResponse(
            access_token=f"{ACCESS_TOKEN_PREFIX}test-access-token-value",
            access_expires_at=NOW + timedelta(minutes=30),
            refresh_token=f"{REFRESH_TOKEN_PREFIX}test-refresh-token-value",
            refresh_expires_at=NOW + timedelta(days=30),
            owner=OwnerResponse.model_validate(self.owner),
        )


@pytest.fixture
def fake_auth(application: FastAPI) -> FakeAuthService:
    service = FakeAuthService()
    application.dependency_overrides[get_auth_service] = lambda: service
    return service


async def test_auth_status_reports_first_owner_setup(
    client: AsyncClient,
    fake_auth: FakeAuthService,
) -> None:
    response = await client.get("/api/v1/auth/status")

    assert response.status_code == 200
    assert response.json() == {
        "serverId": str(TEST_SERVER_ID),
        "serverName": "Home LiftFlow",
        "setupRequired": True,
        "authenticationAvailable": True,
    }


async def test_setup_requires_a_long_password(client: AsyncClient, fake_auth: FakeAuthService) -> None:
    response = await client.post(
        "/api/v1/auth/setup",
        json={
            "serverName": "Home LiftFlow",
            "displayName": "Corey",
            "username": "cheech",
            "password": "too-short",
            "deviceName": "LiftFlow iPhone",
        },
    )

    assert response.status_code == 422


async def test_setup_returns_refreshable_device_tokens(
    client: AsyncClient,
    fake_auth: FakeAuthService,
) -> None:
    response = await client.post(
        "/api/v1/auth/setup",
        json={
            "serverName": "Home LiftFlow",
            "displayName": "Corey",
            "username": "cheech",
            "password": "correct horse battery staple",
            "deviceName": "LiftFlow iPhone",
        },
    )

    assert response.status_code == 201
    assert response.json()["accessToken"].startswith(ACCESS_TOKEN_PREFIX)
    assert response.json()["refreshToken"].startswith(REFRESH_TOKEN_PREFIX)
    assert response.json()["owner"]["username"] == "cheech"


async def test_protected_owner_endpoint_rejects_missing_bearer_token(
    client: AsyncClient,
    fake_auth: FakeAuthService,
) -> None:
    response = await client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "authentication_required"


async def test_logout_revokes_the_authenticated_device_session(
    client: AsyncClient,
    fake_auth: FakeAuthService,
) -> None:
    response = await client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": "Bearer lf_at_test"},
    )

    assert response.status_code == 200
    assert response.json() == {"signedOut": True}
    assert fake_auth.logged_out_session_id == SESSION_ID


def test_passwords_use_argon2_and_tokens_are_only_compared_by_digest() -> None:
    password_hash = hash_password("correct horse battery staple")
    access_token = new_token(ACCESS_TOKEN_PREFIX)

    assert password_hash.startswith("$argon2id$")
    assert verify_password(password_hash, "correct horse battery staple") is True
    assert verify_password(password_hash, "wrong password") is False
    assert access_token.startswith(ACCESS_TOKEN_PREFIX)
    assert access_token not in digest_token(access_token)
    assert len(digest_token(access_token)) == 64
