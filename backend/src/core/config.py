from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Novita Agent Studio API"
    api_prefix: str = "/api"
    cors_origins: list[str] = ["*"]
    max_iteration_limit: int = 1000
    sandbox_root_path: str = "/home/user"
    default_sandbox_timeout_seconds: int = 60 * 60
    tavily_api_key: str = ""
    exa_api_key: str = ""
    serpapi_api_key: str = ""
    firecrawl_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()