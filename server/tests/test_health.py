import pytest
from fastapi import HTTPException
from fastapi import FastAPI
from httpx import AsyncClient

from app.api.dependencies import require_database


pytestmark = pytest.mark.anyio


async def test_liveness_does_not_claim_database_connectivity(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health/live")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["database"] == "not_checked"


async def test_readiness_reports_database_connectivity(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["database"] == "connected"
    assert response.json()["apiVersion"] == "v1"


async def test_readiness_fails_closed_when_database_is_unavailable(
    client: AsyncClient,
    application: FastAPI,
) -> None:
    async def database_unavailable() -> str:
        raise HTTPException(
            status_code=503,
            detail={"code": "database_unavailable", "message": "PostgreSQL is unavailable."},
        )

    application.dependency_overrides[require_database] = database_unavailable
    response = await client.get("/api/v1/health")

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "database_unavailable"
