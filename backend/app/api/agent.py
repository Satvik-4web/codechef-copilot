import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.agent import (
    AssignmentBatch,
    AssignmentTask,
    TaskPermission,
    AgentRun,
    SubmissionAttempt,
    AgentEvent,
)
from app.schemas.agent import (
    AssignmentBatchSchema,
    AssignmentTaskSchema,
    TaskPermissionSchema,
    TaskPermissionUpdateRequest,
    DiscoverRequest,
    SelectTasksRequest,
    PrepareSubmissionResponse,
    ConfirmSubmissionRequest,
    AgentEventSchema,
)
from app.services.agent.orchestrator import AssignmentOrchestrator
from app.services.agent.fsm import FSMValidator

router = APIRouter(prefix="/api/agent", tags=["agent"])

def _hydrate_task_schema(db: Session, task: AssignmentTask) -> AssignmentTaskSchema:
    perm = db.query(TaskPermission).filter(TaskPermission.task_id == task.id).first()
    perm_schema = TaskPermissionSchema.model_validate(perm) if perm else None
    schema = AssignmentTaskSchema.model_validate(task)
    schema.permission = perm_schema
    return schema

@router.post("/discover", response_model=AssignmentBatchSchema)
async def discover_tasks(req: DiscoverRequest = DiscoverRequest(), db: Session = Depends(get_db)):
    batch = await AssignmentOrchestrator.discover_tasks(db, raw_html=req.raw_html, source_url=req.source_url)
    tasks = db.query(AssignmentTask).filter(AssignmentTask.batch_id == batch.id).all()
    batch_schema = AssignmentBatchSchema.model_validate(batch)
    batch_schema.tasks = [_hydrate_task_schema(db, t) for t in tasks]
    return batch_schema

@router.get("/batches", response_model=List[AssignmentBatchSchema])
async def list_batches(db: Session = Depends(get_db)):
    batches = db.query(AssignmentBatch).order_by(AssignmentBatch.created_at.desc()).limit(20).all()
    results = []
    for b in batches:
        tasks = db.query(AssignmentTask).filter(AssignmentTask.batch_id == b.id).all()
        bs = AssignmentBatchSchema.model_validate(b)
        bs.tasks = [_hydrate_task_schema(db, t) for t in tasks]
        results.append(bs)
    return results

@router.get("/batches/{batch_id}", response_model=AssignmentBatchSchema)
async def get_batch(batch_id: int, db: Session = Depends(get_db)):
    b = db.query(AssignmentBatch).filter(AssignmentBatch.id == batch_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Batch not found")
    tasks = db.query(AssignmentTask).filter(AssignmentTask.batch_id == b.id).all()
    bs = AssignmentBatchSchema.model_validate(b)
    bs.tasks = [_hydrate_task_schema(db, t) for t in tasks]
    return bs

@router.post("/batches/{batch_id}/tasks/select", response_model=List[AssignmentTaskSchema])
async def select_tasks(batch_id: int, req: SelectTasksRequest, db: Session = Depends(get_db)):
    selected = AssignmentOrchestrator.select_tasks_for_queue(db, batch_id, req.task_ids)
    return [_hydrate_task_schema(db, t) for t in selected]

@router.post("/tasks/{task_id}/permission", response_model=TaskPermissionSchema)
async def update_task_permission(task_id: int, req: TaskPermissionUpdateRequest, db: Session = Depends(get_db)):
    perm = AssignmentOrchestrator.update_task_permission(
        db=db,
        task_id=task_id,
        assistance_status=req.assistance_status,
        automated_submission_allowed=req.automated_submission_allowed,
        permission_source=req.permission_source,
        task_mode=req.task_mode
    )
    return TaskPermissionSchema.model_validate(perm)

@router.get("/tasks/{task_id}", response_model=AssignmentTaskSchema)
async def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(AssignmentTask).filter(AssignmentTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return _hydrate_task_schema(db, task)

@router.post("/tasks/{task_id}/start", response_model=AssignmentTaskSchema)
async def start_task(task_id: int, db: Session = Depends(get_db)):
    task = await AssignmentOrchestrator.run_task_pipeline(db, task_id)
    return _hydrate_task_schema(db, task)

@router.post("/tasks/{task_id}/pause", response_model=AssignmentTaskSchema)
async def pause_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(AssignmentTask).filter(AssignmentTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.state = FSMValidator.transition(task.state, "PAUSED")
    task.current_phase = "paused"
    db.commit()
    AssignmentOrchestrator.emit_event(db, task.id, "TASK_PAUSED", f"Task '{task.title}' paused by user")
    return _hydrate_task_schema(db, task)

@router.post("/tasks/{task_id}/resume", response_model=AssignmentTaskSchema)
async def resume_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(AssignmentTask).filter(AssignmentTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.state = FSMValidator.transition(task.state, "QUEUED")
    task.current_phase = "queued"
    db.commit()
    AssignmentOrchestrator.emit_event(db, task.id, "TASK_RESUMED", f"Task '{task.title}' resumed to queue")
    return _hydrate_task_schema(db, task)

@router.post("/tasks/{task_id}/cancel", response_model=AssignmentTaskSchema)
async def cancel_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(AssignmentTask).filter(AssignmentTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.state = FSMValidator.transition(task.state, "CANCELLED")
    task.current_phase = "cancelled"
    db.commit()
    AssignmentOrchestrator.emit_event(db, task.id, "TASK_CANCELLED", f"Task '{task.title}' cancelled by user")
    return _hydrate_task_schema(db, task)

@router.get("/tasks/{task_id}/events", response_model=List[AgentEventSchema])
async def get_task_events(task_id: int, db: Session = Depends(get_db)):
    events = db.query(AgentEvent).filter(AgentEvent.task_id == task_id).order_by(AgentEvent.created_at.asc()).all()
    return [AgentEventSchema.model_validate(e) for e in events]

@router.post("/tasks/{task_id}/submission/prepare", response_model=PrepareSubmissionResponse)
async def prepare_submission(task_id: int, db: Session = Depends(get_db)):
    res = await AssignmentOrchestrator.prepare_submission(db, task_id)
    return PrepareSubmissionResponse(**res)

@router.post("/tasks/{task_id}/submission/confirm")
async def confirm_submission(task_id: int, req: ConfirmSubmissionRequest, db: Session = Depends(get_db)):
    res = await AssignmentOrchestrator.confirm_and_submit(db, task_id, req.confirmation_token)
    return res

@router.get("/tasks/{task_id}/submission/status")
async def get_submission_status(task_id: int, db: Session = Depends(get_db)):
    latest = db.query(SubmissionAttempt).filter(SubmissionAttempt.task_id == task_id).order_by(SubmissionAttempt.created_at.desc()).first()
    if not latest:
        return {"has_attempt": False, "verdict": "NONE"}
    return {
        "has_attempt": True,
        "status": latest.status,
        "visible_verdict": latest.visible_verdict,
        "observed_at": latest.verdict_observed_at,
        "code_hash": latest.code_hash
    }

@router.post("/queue/stop")
async def emergency_stop_queue(db: Session = Depends(get_db)):
    res = AssignmentOrchestrator.emergency_stop(db)
    return res

@router.post("/queue/clear")
async def clear_queue(db: Session = Depends(get_db)):
    tasks = db.query(AssignmentTask).filter(AssignmentTask.state.in_(["QUEUED", "DISCOVERED"])).all()
    for t in tasks:
        t.state = "CANCELLED"
    db.commit()
    return {"cleared_count": len(tasks)}
