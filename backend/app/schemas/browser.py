from pydantic import BaseModel, Field
from typing import Optional

class BrowserStatusResponse(BaseModel):
    running: bool
    current_url: Optional[str] = None
    current_title: Optional[str] = None
    is_challenge_detected: bool = False
    message: str = "Ready"

class BrowserLaunchRequest(BaseModel):
    headless: bool = False

class BrowserNavigateRequest(BaseModel):
    url: str = Field(..., max_length=2048)

class BrowserCaptureResponse(BaseModel):
    url: str
    title: str
    html: str
    is_challenge_detected: bool = False
