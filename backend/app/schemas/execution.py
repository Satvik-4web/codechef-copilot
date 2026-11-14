from pydantic import BaseModel, Field
from typing import List, Optional

class TestCaseInput(BaseModel):
    name: str = "Test Case"
    stdin: str = ""
    expected_stdout: str = ""

class ExecutionRequest(BaseModel):
    language: str = Field(default="cpp17", pattern="^(cpp17|python3)$")
    source_code: str = Field(..., max_length=100000)
    tests: List[TestCaseInput] = Field(default_factory=list)
    draft_id: Optional[int] = None

class TestResultOutput(BaseModel):
    name: str
    passed: bool
    stdin: str
    expected_stdout: str
    actual_stdout: str
    stderr: str
    status: str  # passed, wrong_answer, timeout, runtime_error
    duration_ms: float

class ExecutionResponse(BaseModel):
    run_id: int
    status: str  # success, compile_error, runtime_error, timeout, output_mismatch, docker_unavailable
    compile_stdout: str = ""
    compile_stderr: str = ""
    results: List[TestResultOutput] = Field(default_factory=list)
    duration_ms: float = 0.0
    is_docker_isolated: bool = False
    message: str = ""
