from pydantic import BaseModel, Field
from typing import Optional, List

class ExplainRequest(BaseModel):
    problem_id: Optional[int] = None
    statement: Optional[str] = None

class HintRequest(BaseModel):
    problem_id: Optional[int] = None
    current_code: Optional[str] = None
    hint_level: int = Field(default=1, ge=1, le=5, description="Graduated hint level 1 to 5")

class ApproachRequest(BaseModel):
    problem_id: Optional[int] = None

class ReviewRequest(BaseModel):
    problem_id: Optional[int] = None
    source_code: str = Field(..., max_length=100000)
    language: str = "cpp17"

class DebugRequest(BaseModel):
    problem_id: Optional[int] = None
    source_code: str = Field(..., max_length=100000)
    compiler_error: Optional[str] = None
    runtime_error: Optional[str] = None

class PracticeSolutionRequest(BaseModel):
    problem_id: Optional[int] = None
    problem_statement: Optional[str] = None
    extracted_code: Optional[str] = None
    editor_code: Optional[str] = None
    language: Optional[str] = "python"
    title: Optional[str] = None
    user_confirmed_allowed: bool = Field(
        ...,
        description="Explicit user confirmation that AI-generated practice code is permitted for this task"
    )

class AutoSolveRequest(BaseModel):
    problem_id: Optional[int] = None
    problem_statement: Optional[str] = None
    extracted_code: Optional[str] = None
    editor_code: Optional[str] = None
    language: Optional[str] = "python"
    title: Optional[str] = None
    user_confirmed_allowed: bool = True

class AssistantResponse(BaseModel):
    message: str
    interaction_type: str
    hint_level: Optional[int] = None
    generated_code: Optional[str] = None
    is_ai_assisted: bool = False
    disclaimer: Optional[str] = None

class MCQSolveRequest(BaseModel):
    question: str
    options: List[str]
    context: Optional[str] = None

class MCQSolveResponse(BaseModel):
    correct_option_index: int
    correct_option_text: str
    explanation: Optional[str] = None

class AutoHealRequest(BaseModel):
    problem_statement: Optional[str] = None
    current_code: str
    error_output: str
    language: Optional[str] = "python"
    title: Optional[str] = None

class AutoHealResponse(BaseModel):
    fixed_code: str
    explanation: Optional[str] = None
