import pytest
from pydantic import ValidationError

from app.core.config import DEVELOPMENT_PASSWORD, Settings


def test_database_url_escapes_credentials() -> None:
    settings = Settings(
        _env_file=None,
        postgres_user="liftflow-owner",
        postgres_password="pass@word/with spaces",
    )

    url = settings.database_url.render_as_string(hide_password=False)

    assert url.startswith("postgresql+asyncpg://liftflow-owner:")
    assert "pass%40word%2Fwith" in url
    assert "pass@word/with spaces" not in url
    assert url.endswith("@postgres:5432/liftflow")


def test_production_rejects_the_example_password() -> None:
    with pytest.raises(ValidationError, match="unique PostgreSQL password"):
        Settings(
            _env_file=None,
            environment="production",
            postgres_password=DEVELOPMENT_PASSWORD,
        )


def test_production_accepts_a_unique_password() -> None:
    settings = Settings(
        _env_file=None,
        environment="production",
        postgres_password="a-unique-production-secret",
    )

    assert settings.environment == "production"
