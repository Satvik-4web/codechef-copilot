from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import datetime

class TaskPermissionSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    assistance_status: str = Field(default="unknown", pattern="^(unknown|learning_only|ai_assistance_allowed)$")
    automated_submission_allowed: bool = False
    permission_source: str = "Not specified"
    confirmed_at: Optional[datetime.datetime] = None
    last_confirmed_at: Optional[datetime.datetime] = None
    task_mode: str = Field(default="learning", pattern="^(learning|authorized_practice)$")

class TaskPermissionUpdateRequest(BaseModel):
    assistance_status: str = Field(..., pattern="^(unknown|learning_only|ai_assistance_allowed)$")
    automated_submission_allowed: bool = False
    permission_source: str = "User confirmed"
    task_mode: str = Field(default="learning", pattern="^(learning|authorized_practice)$")

class AssignmentTaskSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    batch_id: int
    problem_id: Optional[int] = None
    title: str
    url: str
    visible_status: str
    course_group: str
    state: str
    current_phase: str
    last_error: Optional[str] = None
    permission: Optional[TaskPermissionSchema] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

class AssignmentBatchSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_url: str
    status: str
    tasks: List[AssignmentTaskSchema] = Field(default_factory=list)
    created_at: datetime.datetime
    updated_at: datetime.datetime

class DiscoverRequest(BaseModel):
    raw_html: Optional[str] = None
    source_url: Optional[str] = None

class SelectTasksRequest(BaseModel):
    task_ids: List[int]

class PrepareSubmissionResponse(BaseModel):
    task_id: int
    draft_id: int
    title: str
    destination_url: str
    code_hash: str
    code_snippet: str
    confirmation_token: str
    expires_in_seconds: int
    disclaimer: str

class ConfirmSubmissionRequest(BaseModel):
    confirmation_token: str

class AgentEventSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: Optional[int]
    agent_run_id: Optional[int]
    event_type: str
    message: str
    metadata_json: str
    created_at: datetime.datetime
