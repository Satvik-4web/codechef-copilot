from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.assistant import (
    ExplainRequest,
    HintRequest,
    ApproachRequest,
    ReviewRequest,
    DebugRequest,
    PracticeSolutionRequest,
    AutoSolveRequest,
    AssistantResponse,
    MCQSolveRequest,
    MCQSolveResponse,
    AutoHealRequest,
    AutoHealResponse,
)
from app.services.assistant.service import AssistantService
from app.config import settings

router = APIRouter(prefix="/api/assistant", tags=["assistant"])

@router.get("/status")
async def assistant_status():
    return {
        "provider": settings.AI_PROVIDER if settings.AI_API_KEY else "offline",
        "api_key_configured": bool(settings.AI_API_KEY),
    }

@router.post("/explain", response_model=AssistantResponse)
async def explain_problem(req: ExplainRequest, db: Session = Depends(get_db)):
    res = await AssistantService.explain(db, req.problem_id, req.statement)
    return res

@router.post("/hint", response_model=AssistantResponse)
async def get_hint(req: HintRequest, db: Session = Depends(get_db)):
    res = await AssistantService.hint(db, req.problem_id, req.current_code, req.hint_level)
    return res

@router.post("/approach", response_model=AssistantResponse)
async def discuss_approach(req: ApproachRequest, db: Session = Depends(get_db)):
    res = await AssistantService.approach(db, req.problem_id)
    return res

@router.post("/review", response_model=AssistantResponse)
async def review_code(req: ReviewRequest, db: Session = Depends(get_db)):
    res = await AssistantService.review(db, req.problem_id, req.source_code, req.language)
    return res

@router.post("/debug", response_model=AssistantResponse)
async def debug_error(req: DebugRequest, db: Session = Depends(get_db)):
    res = await AssistantService.debug(
        db,
        req.problem_id,
        req.source_code,
        req.compiler_error,
        req.runtime_error
    )
    return res

@router.post("/practice-solution", response_model=AssistantResponse)
@router.post("/solution", response_model=AssistantResponse)
async def generate_practice_solution(req: PracticeSolutionRequest, db: Session = Depends(get_db)):
    res = await AssistantService.practice_solution(
        db=db,
        problem_id=req.problem_id,
        user_confirmed_allowed=req.user_confirmed_allowed,
        language=req.language,
        problem_statement=req.problem_statement,
        extracted_code=req.extracted_code,
        editor_code=req.editor_code,
        title=req.title
    )
    return res

@router.post("/auto-solve", response_model=AssistantResponse)
async def auto_solve_task(req: AutoSolveRequest, db: Session = Depends(get_db)):
    res = await AssistantService.auto_solve(
        db=db,
        problem_id=req.problem_id,
        problem_statement=req.problem_statement,
        extracted_code=req.extracted_code,
        editor_code=req.editor_code,
        language=req.language,
        title=req.title,
        user_confirmed_allowed=req.user_confirmed_allowed
    )
    return res

@router.post("/solve-mcq", response_model=MCQSolveResponse)
async def solve_mcq_task(req: MCQSolveRequest):
    try:
        return await AssistantService.solve_mcq(
            question=req.question, options=req.options, context=req.context
        )
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

@router.post("/auto-heal", response_model=AutoHealResponse)
async def auto_heal_code(req: AutoHealRequest):
    res = await AssistantService.auto_heal(
        current_code=req.current_code,
        error_output=req.error_output,
        problem_statement=req.problem_statement,
        language=req.language,
        title=req.title
    )
    return res
