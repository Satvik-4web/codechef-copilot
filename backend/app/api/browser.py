from fastapi import APIRouter, HTTPException
from app.services.browser.manager import BrowserManager
from app.schemas.browser import (
    BrowserStatusResponse,
    BrowserLaunchRequest,
    BrowserNavigateRequest,
    BrowserCaptureResponse,
)

router = APIRouter(prefix="/api/browser", tags=["browser"])

@router.get("/status", response_model=BrowserStatusResponse)
async def get_browser_status():
    manager = BrowserManager.get_instance()
    status = await manager.get_status()
    return status

@router.post("/launch", response_model=BrowserStatusResponse)
async def launch_browser(req: BrowserLaunchRequest = BrowserLaunchRequest()):
    manager = BrowserManager.get_instance()
    res = await manager.launch(headless=req.headless)
    return res

@router.post("/close", response_model=BrowserStatusResponse)
async def close_browser():
    manager = BrowserManager.get_instance()
    res = await manager.close()
    return res

@router.post("/capture", response_model=BrowserCaptureResponse)
async def capture_page():
    manager = BrowserManager.get_instance()
    try:
        data = await manager.capture_current_page()
        return data
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/current-page")
async def get_current_page():
    manager = BrowserManager.get_instance()
    status = await manager.get_status()
    return {
        "url": status.get("current_url"),
        "title": status.get("current_title"),
        "is_challenge_detected": status.get("is_challenge_detected", False)
    }

@router.post("/navigate")
async def navigate_browser(req: BrowserNavigateRequest):
    manager = BrowserManager.get_instance()
    try:
        res = await manager.navigate(req.url)
        return res
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
