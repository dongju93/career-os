from typing import ClassVar, Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config: ClassVar[SettingsConfigDict] = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8"
    )

    # Credentials — required, no defaults
    database_url: str
    openai_api_key: str

    # Google OAuth — required
    google_client_id: str
    google_client_secret: str
    redirect_uri: str = "https://career-os.fastapicloud.dev/v1/auth/google/callback"
    # Fallback destination when the session-stored callback_url is missing
    # (e.g. when the session cookie is lost across the OAuth round trip on
    # mobile browsers with strict cross-site cookie policies).
    frontend_url: str = "https://career-os-sigma.vercel.app"

    # CORS — comma-separated list of allowed origins
    allowed_origins: list[str] = [
        "https://career-os-sigma.vercel.app",
        "http://localhost:4173",
        "http://localhost:5173",
    ]

    # JWT — required
    secret_key: str

    # JWT tunables
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    # HTTP client timeouts (seconds) — tunable per environment
    http_fetch_timeout: float = 30.0
    http_image_timeout: float = 10.0

    # OpenAI extraction — tunable per environment
    openai_model: str = "gpt-5.4-mini"
    openai_reasoning_effort: Literal[
        "none", "minimal", "low", "medium", "high", "xhigh"
    ] = "high"
    max_images: int = 10


settings = Settings()
