from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
from pathlib import Path

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_ENV: str = "development"
    BACKEND_HOST: str = "127.0.0.1"
    BACKEND_PORT: int = 8008
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    DATABASE_URL: str = "sqlite:///./codechef_copilot.db"

    # AI Configuration
    AI_PROVIDER: Optional[str] = "gemini"  # "gemini", "openai", or None (offline)
    AI_API_KEY: Optional[str] = None
    AI_MODEL: Optional[str] = "gemini-flash-lite-latest"

    # Code Execution limits
    EXECUTION_TIMEOUT_SECONDS: int = 5
    EXECUTION_MEMORY_MB: int = 256
    DOCKER_IMAGE_NAME: str = "codechef-copilot-cpp:latest"

    # Browser automation settings
    BROWSER_HEADLESS: bool = False
    BROWSER_PROFILE_DIR: str = "./.codechef_profile"

settings = Settings()
