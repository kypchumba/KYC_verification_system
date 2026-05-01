from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "KYC Verification API"
    api_prefix: str = ""
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/kyc"
    uploads_dir: Path = PROJECT_ROOT / "uploads"
    cors_origins: list[str] = ["http://127.0.0.1:5173", "http://localhost:5173"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
