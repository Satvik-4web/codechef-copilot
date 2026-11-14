import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from app.database import Base

class AssignmentBatch(Base):
    __tablename__ = "assignment_batches"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    source_url = Column(String(1024), nullable=False, default="")
    status = Column(String(50), nullable=False, default="discovered") # discovered, in_progress, completed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class AssignmentTask(Base):
    __tablename__ = "assignment_tasks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    batch_id = Column(Integer, ForeignKey("assignment_batches.id", ondelete="CASCADE"), nullable=False)
    problem_id = Column(Integer, ForeignKey("problems.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False, default="Discovered Task")
    url = Column(String(1024), nullable=False, default="")
    visible_status = Column(String(100), nullable=False, default="Unattempted")
    course_group = Column(String(255), nullable=False, default="")
    state = Column(String(50), nullable=False, default="DISCOVERED")
    current_phase = Column(String(50), nullable=False, default="idle")
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class TaskPermission(Base):
    __tablename__ = "task_permissions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("assignment_tasks.id", ondelete="CASCADE"), unique=True, nullable=False)
    # Default is unknown & learning as per strict integrity boundary
    assistance_status = Column(String(50), nullable=False, default="unknown") # unknown, learning_only, ai_assistance_allowed
    automated_submission_allowed = Column(Boolean, nullable=False, default=False)
    permission_source = Column(String(255), nullable=False, default="Not specified")
    confirmed_at = Column(DateTime, nullable=True)
    last_confirmed_at = Column(DateTime, nullable=True)
    task_mode = Column(String(50), nullable=False, default="learning") # learning, authorized_practice

class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("assignment_tasks.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), nullable=False, default="idle") # idle, running, paused, completed, failed, cancelled
    attempt_count = Column(Integer, nullable=False, default=0)
    current_draft_id = Column(Integer, ForeignKey("drafts.id", ondelete="SET NULL"), nullable=True)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)

class SubmissionAttempt(Base):
    __tablename__ = "submission_attempts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("assignment_tasks.id", ondelete="CASCADE"), nullable=False)
    draft_id = Column(Integer, ForeignKey("drafts.id", ondelete="CASCADE"), nullable=False)
    code_hash = Column(String(64), nullable=False)
    status = Column(String(50), nullable=False, default="prepared") # prepared, confirmed, submitting, completed, failed, cancelled
    confirmation_timestamp = Column(DateTime, nullable=True)
    visible_verdict = Column(String(100), nullable=False, default="PENDING")
    verdict_observed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class AgentEvent(Base):
    __tablename__ = "agent_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("assignment_tasks.id", ondelete="CASCADE"), nullable=True)
    agent_run_id = Column(Integer, nullable=True)
    event_type = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    metadata_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
