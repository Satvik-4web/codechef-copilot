import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.problem import Problem
from app.models.draft import Draft
from app.models.execution import ExecutionRun
from app.models.interaction import AssistantInteraction

router = APIRouter(prefix="/api/history", tags=["history"])

@router.get("")
async def get_history(db: Session = Depends(get_db)):
    recent_problems = db.query(Problem).order_by(Problem.created_at.desc()).limit(10).all()
    recent_drafts = db.query(Draft).order_by(Draft.updated_at.desc()).limit(10).all()
    recent_runs = db.query(ExecutionRun).order_by(ExecutionRun.created_at.desc()).limit(10).all()
    recent_interactions = db.query(AssistantInteraction).order_by(AssistantInteraction.created_at.desc()).limit(15).all()

    return {
        "problems": [
            {
                "id": p.id,
                "title": p.title,
                "source_url": p.source_url,
                "created_at": p.created_at
            }
            for p in recent_problems
        ],
        "drafts": [
            {
                "id": d.id,
                "problem_id": d.problem_id,
                "language": d.language,
                "mode": d.mode,
                "updated_at": d.updated_at
            }
            for d in recent_drafts
        ],
        "runs": [
            {
                "id": r.id,
                "draft_id": r.draft_id,
                "status": r.status,
                "duration_ms": r.duration_ms,
                "created_at": r.created_at
            }
            for r in recent_runs
        ],
        "interactions": [
            {
                "id": i.id,
                "problem_id": i.problem_id,
                "interaction_type": i.interaction_type,
                "created_at": i.created_at
            }
            for i in recent_interactions
        ]
    }
