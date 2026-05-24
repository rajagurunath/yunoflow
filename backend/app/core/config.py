"""Application settings, loaded from environment / .env (pydantic-settings)."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    # Database (native-dev defaults target the docker 'db' published on host port 5433;
    # the in-compose backend overrides these via env to reach db:5432 on the compose network)
    database_url: str = "postgresql+asyncpg://yuno:yuno@localhost:5433/yuno"
    checkpoint_db_uri: str = "postgresql://yuno:yuno@localhost:5433/yuno"

    # LLM (OpenAI-compatible)
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    llm_price_in: float = 0.00015
    llm_price_out: float = 0.0006

    # Console auth (gates the web console; landing page stays public)
    auth_username: str = "admin"
    auth_password: str = "orchestra"

    # Channels
    telegram_bot_token: str = ""

    # Observability
    mlflow_tracking_uri: str = "http://localhost:5000"
    feature_mlflow: bool = False

    # Gated differentiators
    feature_a2a: bool = False
    feature_deepagents: bool = False
    feature_dbos: bool = False

    @property
    def sync_database_url(self) -> str:
        """Sync (psycopg) URL for Alembic, derived from the async URL."""
        return self.database_url.replace("+asyncpg", "+psycopg")


settings = Settings()
