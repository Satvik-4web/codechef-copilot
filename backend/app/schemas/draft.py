from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
import datetime

class DraftCreateRequest(BaseModel):
    problem_id: Optional[int] = None
    language: str = "cpp17"
    source_code: str = Field(..., max_length=100000)
    mode: str = "learning"

class DraftUpdateRequest(BaseModel):
    source_code: Optional[str] = Field(None, max_length=100000)
    language: Optional[str] = None
    mode: Optional[str] = None

class DraftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    problem_id: Optional[int]
    language: str
    source_code: str
    mode: str
    created_at: datetime.datetime
    updated_at: datetime.datetime
