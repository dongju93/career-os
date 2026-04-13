from typing import ClassVar

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config: ClassVar[SettingsConfigDict] = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8"
    )

    # Credentials — required, no defaults
    database_url: str
    openai_api_key: str

    # HTTP client timeouts (seconds) — tunable per environment
    http_fetch_timeout: float = 30.0
    http_image_timeout: float = 10.0

    # OpenAI extraction — tunable per environment
    openai_model: str = "gpt-5.4-mini"
    openai_temperature: int = 0
    max_images: int = 10


settings = Settings()
