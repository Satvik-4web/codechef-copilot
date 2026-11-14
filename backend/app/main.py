from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.api.browser import router as browser_router
from app.api.problems import router as problems_router
from app.api.drafts import router as drafts_router
from app.api.assistant import router as assistant_router
from app.api.execution import router as execution_router
from app.api.history import router as history_router
from app.api.settings import router as settings_router
from app.api.agent import router as agent_router

from app.services.browser.manager import BrowserManager

# Ensure SQLite schema is created immediately on import
init_db()

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield
    # Graceful shutdown: close browser if still open
    try:
        await BrowserManager.get_instance().close()
    except Exception:
        pass

app = FastAPI(
    title="CodeChef Copilot Backend",
    description="Local-first, browser-assisted educational coding companion for CodeChef",
    version="1.0.0",
    lifespan=lifespan
)

origins = [
    settings.FRONTEND_ORIGIN,
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^(chrome-extension://.*|http://localhost:\d+|http://127\.0\.0\.1:\d+)$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(browser_router)
app.include_router(problems_router)
app.include_router(drafts_router)
app.include_router(assistant_router)
app.include_router(execution_router)
app.include_router(history_router)
app.include_router(settings_router)
app.include_router(agent_router)

@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "app": "CodeChef Copilot",
        "version": "1.0.0",
        "mode_support": ["learning", "practice"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.BACKEND_HOST, port=settings.BACKEND_PORT, reload=True)
