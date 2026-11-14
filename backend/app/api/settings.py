from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.settings import UserSettings
from app.schemas.settings import SettingsResponse, SettingsUpdateRequest
from app.services.execution.runner import ExecutionRunner
from app.config import settings as app_settings

router = APIRouter(prefix="/api/settings", tags=["settings"])

def _get_or_create_settings(db: Session) -> UserSettings:
    s = db.query(UserSettings).filter(UserSettings.id == 1).first()
    if not s:
        s = UserSettings(
            id=1,
            active_mode="learning",
            execution_timeout_seconds=app_settings.EXECUTION_TIMEOUT_SECONDS,
            execution_memory_mb=app_settings.EXECUTION_MEMORY_MB,
            ai_provider=app_settings.AI_PROVIDER or "",
            ai_model=app_settings.AI_MODEL or ""
        )
        db.add(s)
        db.commit()
        db.refresh(s)
    return s

@router.get("", response_model=SettingsResponse)
async def get_settings(db: Session = Depends(get_db)):
    s = _get_or_create_settings(db)
    docker_ok = ExecutionRunner.is_docker_available()
    return SettingsResponse(
        active_mode=s.active_mode,
        execution_timeout_seconds=s.execution_timeout_seconds,
        execution_memory_mb=s.execution_memory_mb,
        ai_provider=s.ai_provider,
        ai_model=s.ai_model,
        docker_available=docker_ok
    )

@router.patch("", response_model=SettingsResponse)
async def update_settings(req: SettingsUpdateRequest, db: Session = Depends(get_db)):
    s = _get_or_create_settings(db)
    if req.active_mode is not None:
        s.active_mode = req.active_mode
    if req.execution_timeout_seconds is not None:
        s.execution_timeout_seconds = req.execution_timeout_seconds
    if req.execution_memory_mb is not None:
        s.execution_memory_mb = req.execution_memory_mb
    if req.ai_provider is not None:
        s.ai_provider = req.ai_provider
        app_settings.AI_PROVIDER = req.ai_provider
    if req.ai_model is not None:
        s.ai_model = req.ai_model
        app_settings.AI_MODEL = req.ai_model
    if req.ai_api_key is not None:
        app_settings.AI_API_KEY = req.ai_api_key
        if not s.ai_provider:
            s.ai_provider = "openai" if req.ai_api_key.startswith("sk-") else "gemini"
            app_settings.AI_PROVIDER = s.ai_provider

    db.commit()
    db.refresh(s)

    docker_ok = ExecutionRunner.is_docker_available()
    return SettingsResponse(
        active_mode=s.active_mode,
        execution_timeout_seconds=s.execution_timeout_seconds,
        execution_memory_mb=s.execution_memory_mb,
        ai_provider=s.ai_provider,
        ai_model=s.ai_model,
        docker_available=docker_ok
    )
