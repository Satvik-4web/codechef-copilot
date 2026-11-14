from pydantic import BaseModel, Field
from typing import Optional

class SettingsResponse(BaseModel):
    active_mode: str
    execution_timeout_seconds: int
    execution_memory_mb: int
    ai_provider: Optional[str]
    ai_model: Optional[str]
    docker_available: bool

class SettingsUpdateRequest(BaseModel):
    active_mode: Optional[str] = Field(None, pattern="^(learning|practice)$")
    execution_timeout_seconds: Optional[int] = Field(None, ge=1, le=30)
    execution_memory_mb: Optional[int] = Field(None, ge=64, le=1024)
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    ai_api_key: Optional[str] = None
