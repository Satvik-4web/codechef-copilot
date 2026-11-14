from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.draft import Draft
from app.schemas.draft import DraftCreateRequest, DraftUpdateRequest, DraftResponse

router = APIRouter(prefix="/api/drafts", tags=["drafts"])

@router.post("", response_model=DraftResponse)
async def create_draft(req: DraftCreateRequest, db: Session = Depends(get_db)):
    draft = Draft(
        problem_id=req.problem_id,
        language=req.language,
        source_code=req.source_code,
        mode=req.mode
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return draft

@router.get("/problem/{problem_id}", response_model=Optional[DraftResponse])
async def get_draft_for_problem(problem_id: int, db: Session = Depends(get_db)):
    draft = db.query(Draft).filter(Draft.problem_id == problem_id).order_by(Draft.updated_at.desc()).first()
    return draft

@router.put("/{draft_id}", response_model=DraftResponse)
async def update_draft(draft_id: int, req: DraftUpdateRequest, db: Session = Depends(get_db)):
    draft = db.query(Draft).filter(Draft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    if req.source_code is not None:
        draft.source_code = req.source_code
    if req.language is not None:
        draft.language = req.language
    if req.mode is not None:
        draft.mode = req.mode

    db.commit()
    db.refresh(draft)
    return draft
