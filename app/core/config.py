"""
Centralized application settings.

Every config value the app needs is declared here as a typed field and
loaded from environment variables (via .env in development, real env
vars in production). Nothing else in the codebase should call
os.getenv() directly -- import `settings` from here instead. This
keeps config discoverable in one place and gives us validation for
free (e.g. a malformed DATABASE_URL fails fast at startup, not at
first query).
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- App ---
    app_name: str = "RAG Chatbot SaaS"
    app_env: Literal["development", "staging", "production"] = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"

    # --- Security ---
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # --- Database ---
    database_url: str

    # --- Redis ---
    redis_url: str = "redis://redis:6379/0"

    # --- LLM providers ---
    default_llm_provider: Literal["openai", "anthropic", "gemini"] = "openai"

    openai_api_key: str | None = None
    openai_chat_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"

    anthropic_api_key: str | None = None
    anthropic_chat_model: str = "claude-sonnet-4-6"

    gemini_api_key: str | None = None
    gemini_chat_model: str = "gemini-2.0-flash"

    # --- File storage ---
    upload_dir: str = "/app/storage/uploads"
    max_upload_size_mb: int = 25

    # --- Rate limiting ---
    rate_limit_per_minute: int = 60

    # --- CORS ---
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """
    Cached settings accessor. lru_cache means the .env file is parsed
    once per process, not on every import -- import `settings` below
    for the common case, or call get_settings() directly inside
    functions if you need to bypass the cache (e.g. in tests).
    """
    return Settings()


settings = get_settings()
