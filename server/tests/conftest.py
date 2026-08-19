from collections.abc import AsyncIterator, Iterator
from uuid import UUID

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.dependencies import load_server_identity, require_database
from app.core.config import Settings, get_settings
from app.main import create_app
from app.schemas.api import ServerIdentity


TEST_SERVER_ID = UUID("11111111-2222-4333-8444-555555555555")


@pytest.fixture
def settings() -> Settings:
    return Settings(
        _env_file=None,
        environment="test",
        postgres_password="test-password",
    )


@pytest.fixture
def application(settings: Settings) -> Iterator[FastAPI]:
    application = create_app(settings)

    async def database_connected() -> str:
        return "connected"

    async def server_identity() -> ServerIdentity:
        return ServerIdentity(server_id=TEST_SERVER_ID, display_name="LiftFlow Test")

    application.dependency_overrides[get_settings] = lambda: settings
    application.dependency_overrides[require_database] = database_connected
    application.dependency_overrides[load_server_identity] = server_identity

    yield application

    application.dependency_overrides.clear()


@pytest.fixture
async def client(application: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=application)
    async with AsyncClient(transport=transport, base_url="http://testserver") as test_client:
        yield test_client
