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

    # Google RISC (Cross-Account Protection) — Security Event Token receiver
    # The SET's `aud` claim must match this value. Google sets `aud` to the
    # OAuth client ID of the project that registered the RISC stream, so this
    # defaults to `google_client_id` when unset (see `risc_audience` property).
    google_risc_audience: str | None = None
    google_risc_issuer: str = "https://accounts.google.com"
    google_risc_jwks_uri: str = "https://www.googleapis.com/oauth2/v3/certs"
    google_risc_jwks_cache_ttl_seconds: int = 60 * 60  # 1 hour
    google_risc_unknown_kid_refresh_cooldown_seconds: int = 60
    # Accept SETs whose `iat` is at most this far in the future (clock skew).
    google_risc_max_iat_skew_seconds: int = 60 * 5  # 5 minutes
    google_risc_http_timeout_seconds: float = 10.0

    # HTTP client timeouts (seconds) — tunable per environment
    http_fetch_timeout: float = 30.0
    http_image_timeout: float = 10.0

    # OpenAI extraction — tunable per environment
    openai_model: str = "gpt-5.4-mini"
    openai_reasoning_effort: Literal[
        "none", "minimal", "low", "medium", "high", "xhigh"
    ] = "medium"
    max_images: int = 10
    # Per-image byte cap applied during streaming download (default 2 MB).
    # Prevents a single large image from blowing up memory and OpenAI payload.
    max_image_bytes: int = 2 * 1024 * 1024
    # Total base64 payload cap across all collected images (default 10 MB).
    # base64 expands raw bytes by ~33 %, so 10 MB ≈ 7.5 MB of raw image data.
    max_total_image_bytes: int = 10 * 1024 * 1024

    @property
    def risc_audience(self) -> str:
        return self.google_risc_audience or self.google_client_id


settings = Settings()
