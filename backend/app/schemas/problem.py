from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import datetime

class TestCaseSchema(BaseModel):
    name: str = "Sample Test"
    stdin: str = ""
    expected_stdout: str = ""

class ProblemParseRequest(BaseModel):
    raw_html: Optional[str] = Field(None, description="HTML captured from page")
    url: Optional[str] = Field(None, max_length=2048)
    manual_statement: Optional[str] = Field(None, description="Fallback manual statement if parsing incomplete")
    manual_title: Optional[str] = None

class ProblemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    source_url: str
    statement: str
    input_format: str
    output_format: str
    constraints: str
    examples: List[TestCaseSchema]
    parser_confidence: float
    created_at: datetime.datetime
    updated_at: datetime.datetime

class ProblemUpdateRequest(BaseModel):
    title: Optional[str] = None
    statement: Optional[str] = None
    input_format: Optional[str] = None
    output_format: Optional[str] = None
    constraints: Optional[str] = None
    examples: Optional[List[TestCaseSchema]] = None
