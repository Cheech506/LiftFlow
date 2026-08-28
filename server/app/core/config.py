from functools import lru_cache
from typing import Literal

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


DEVELOPMENT_PASSWORD = "change-me-before-exposing"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="LIFTFLOW_",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "LiftFlow Server"
    environment: Literal["development", "test", "production"] = "development"
    server_version: str = "0.3.0"
    api_version: str = "v1"
    api_prefix: str = "/api/v1"
    minimum_client_version: str = "0.7.0"
    mobile_storage_version: int = 12

    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_db: str = "liftflow"
    postgres_user: str = "liftflow"
    postgres_password: SecretStr = SecretStr(DEVELOPMENT_PASSWORD)
    database_pool_size: int = 5
    database_max_overflow: int = 10
    access_token_minutes: int = 30
    refresh_token_days: int = 30
    cors_origins: str = "http://localhost:8081,http://127.0.0.1:8081"

    @model_validator(mode="after")
    def reject_development_secret_in_production(self) -> "Settings":
        if (
            self.environment == "production"
            and self.postgres_password.get_secret_value() == DEVELOPMENT_PASSWORD
        ):
            raise ValueError("Production requires a unique PostgreSQL password.")
        return self

    @property
    def database_url(self) -> URL:
        return URL.create(
            drivername="postgresql+asyncpg",
            username=self.postgres_user,
            password=self.postgres_password.get_secret_value(),
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        )

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
