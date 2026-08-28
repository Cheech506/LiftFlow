import pytest
from httpx import AsyncClient

from conftest import TEST_SERVER_ID


pytestmark = pytest.mark.anyio


async def test_server_info_exposes_a_stable_connection_contract(
    client: AsyncClient,
) -> None:
    response = await client.get("/api/v1/server-info")

    assert response.status_code == 200
    assert response.json() == {
        "serverId": str(TEST_SERVER_ID),
        "name": "LiftFlow Test",
        "serverVersion": "0.3.0",
        "apiVersion": "v1",
        "minimumClientVersion": "0.7.0",
        "storageVersion": 12,
        "environment": "test",
        "capabilities": {
            "authentication": True,
            "backupImport": True,
            "sync": False,
            "webApp": False,
        },
    }


async def test_openapi_contains_only_versioned_public_foundation_routes(
    client: AsyncClient,
) -> None:
    document = (await client.get("/openapi.json")).json()

    assert document["info"]["version"] == "0.3.0"
    assert "/api/v1/health" in document["paths"]
    assert "/api/v1/health/live" in document["paths"]
    assert "/api/v1/server-info" in document["paths"]
    assert "/api/v1/auth/status" in document["paths"]
    assert "/api/v1/auth/setup" in document["paths"]
    assert "/api/v1/auth/login" in document["paths"]
    assert "/api/v1/auth/refresh" in document["paths"]
    assert "/api/v1/auth/me" in document["paths"]
    assert "/api/v1/auth/logout" in document["paths"]
    assert "/api/v1/data/summary" in document["paths"]
    assert "/api/v1/data/snapshot" in document["paths"]
    assert "/api/v1/health/ready" not in document["paths"]
