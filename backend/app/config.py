import os
from functools import lru_cache
from typing import List

from pydantic import Field, ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )
    app_name: str = "Concert Tickets Backend"
    api_prefix: str = "/api"
    cookie_name: str = "user_id"
    cookie_max_age: int = 60 * 60 * 24 * 30
    cors_origins: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:8000",
            "http://localhost:8001",
            "http://127.0.0.1:8000",
            "http://127.0.0.1:8001",
            "http://localhost:5173",
        ]
    )
    debug: bool = False
    data_dir: str = "../data"


@lru_cache
def get_settings() -> Settings:
    return Settings(_env_file=os.getenv("ENV_FILE", ".env"))
