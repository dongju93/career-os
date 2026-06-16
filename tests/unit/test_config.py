import pytest
from pydantic import ValidationError

from career_os_api.config import Settings


def _required_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://career_os:career_os@localhost:5432/career_os_test",
    )
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-api-key")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-google-client-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-google-client-secret")
    monkeypatch.setenv("SECRET_KEY", "x" * 32)


def test_production_defaults_tune_pool_and_logging(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _required_env(monkeypatch)
    monkeypatch.setenv("ENVIRONMENT", "production")

    cfg = Settings(_env_file=None)

    assert cfg.database_pool_max_size == 3
    assert cfg.database_pool_min_size == 1
    assert cfg.database_pool_max_lifetime == 300.0
    assert cfg.database_pool_max_idle == 60.0
    assert cfg.log_level == "WARNING"
    assert cfg.trusted_hosts == [
        "career-os.fastapicloud.dev",
        "*.fastapicloud.dev",
    ]


def test_production_defaults_respect_explicit_overrides(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _required_env(monkeypatch)
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("DATABASE_POOL_MAX_SIZE", "7")
    monkeypatch.setenv("LOG_LEVEL", "INFO")

    cfg = Settings(_env_file=None)

    assert cfg.database_pool_max_size == 7
    assert cfg.log_level == "INFO"


def test_production_rejects_weak_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://career_os:career_os@localhost:5432/career_os_test",
    )
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-api-key")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-google-client-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-google-client-secret")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key")
    monkeypatch.setenv("ENVIRONMENT", "production")

    with pytest.raises(ValidationError, match="SECRET_KEY"):
        Settings()
