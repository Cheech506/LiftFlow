from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


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


class OwnerResponse(ApiModel):
    id: UUID
    username: str
    display_name: str
    created_at: datetime


class AuthStatusResponse(ApiModel):
    server_id: UUID
    server_name: str
    setup_required: bool
    authentication_available: Literal[True] = True


class SetupOwnerRequest(ApiModel):
    server_name: str = Field(min_length=1, max_length=100)
    display_name: str = Field(min_length=1, max_length=100)
    username: str = Field(min_length=3, max_length=50)
    password: SecretStr = Field(min_length=12, max_length=128)
    device_name: str = Field(min_length=1, max_length=100)

    @field_validator("server_name", "display_name", "device_name")
    @classmethod
    def strip_display_values(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped.replace("-", "").replace("_", "").isalnum():
            raise ValueError("may only contain letters, numbers, hyphens, and underscores")
        return stripped


class LoginRequest(ApiModel):
    username: str = Field(min_length=1, max_length=50)
    password: SecretStr = Field(min_length=1, max_length=128)
    device_name: str = Field(min_length=1, max_length=100)


class RefreshRequest(ApiModel):
    refresh_token: str = Field(min_length=20, max_length=256)
    device_name: str | None = Field(default=None, min_length=1, max_length=100)


class SessionTokenResponse(ApiModel):
    token_type: Literal["Bearer"] = "Bearer"
    access_token: str
    access_expires_at: datetime
    refresh_token: str
    refresh_expires_at: datetime
    owner: OwnerResponse


class LogoutResponse(ApiModel):
    signed_out: Literal[True] = True
