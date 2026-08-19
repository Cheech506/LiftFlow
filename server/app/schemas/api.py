from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class HealthResponse(ApiModel):
    status: Literal["ok"]
    service: str
    version: str
    api_version: str
    database: Literal["connected", "not_checked"]
    timestamp: datetime


class ServerIdentity(BaseModel):
    server_id: UUID
    display_name: str


class ServerCapabilities(ApiModel):
    authentication: bool
    backup_import: bool
    sync: bool
    web_app: bool


class ServerInfoResponse(ApiModel):
    server_id: UUID
    name: str
    server_version: str
    api_version: str
    minimum_client_version: str
    storage_version: int
    environment: Literal["development", "test", "production"]
    capabilities: ServerCapabilities
