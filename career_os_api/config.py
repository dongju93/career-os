from typing import ClassVar

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config: ClassVar[SettingsConfigDict] = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8"
    )

    database_url: str
    openai_api_key: str
    api_v1: str = "v1"
    api_v2: str = "v2"


settings = Settings()
