import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.problem import Problem
from app.schemas.problem import (
    ProblemParseRequest,
    ProblemResponse,
    ProblemUpdateRequest,
    TestCaseSchema,
)
from app.services.parser.problem_parser import ProblemParser

router = APIRouter(prefix="/api/problems", tags=["problems"])

@router.post("/parse", response_model=ProblemResponse)
async def parse_and_save_problem(req: ProblemParseRequest, db: Session = Depends(get_db)):
    html = req.raw_html or ""
    parsed = ProblemParser.parse(
        html=html,
        url=req.url or "",
        manual_statement=req.manual_statement,
        manual_title=req.manual_title
    )

    problem = Problem(
        title=parsed["title"],
        source_url=parsed["source_url"],
        statement=parsed["statement"],
        input_format=parsed["input_format"],
        output_format=parsed["output_format"],
        constraints=parsed["constraints"],
        examples_json=json.dumps(parsed["examples"]),
        parser_confidence=parsed["parser_confidence"]
    )
    db.add(problem)
    db.commit()
    db.refresh(problem)

    return ProblemResponse(
        id=problem.id,
        title=problem.title,
        source_url=problem.source_url,
        statement=problem.statement,
        input_format=problem.input_format,
        output_format=problem.output_format,
        constraints=problem.constraints,
        examples=[TestCaseSchema(**ex) for ex in json.loads(problem.examples_json)],
        parser_confidence=problem.parser_confidence,
        created_at=problem.created_at,
        updated_at=problem.updated_at
    )

@router.get("", response_model=List[ProblemResponse])
async def list_problems(db: Session = Depends(get_db)):
    problems = db.query(Problem).order_by(Problem.created_at.desc()).limit(50).all()
    results = []
    for p in problems:
        results.append(ProblemResponse(
            id=p.id,
            title=p.title,
            source_url=p.source_url,
            statement=p.statement,
            input_format=p.input_format,
            output_format=p.output_format,
            constraints=p.constraints,
            examples=[TestCaseSchema(**ex) for ex in json.loads(p.examples_json or "[]")],
            parser_confidence=p.parser_confidence,
            created_at=p.created_at,
            updated_at=p.updated_at
        ))
    return results

@router.get("/{problem_id}", response_model=ProblemResponse)
async def get_problem(problem_id: int, db: Session = Depends(get_db)):
    p = db.query(Problem).filter(Problem.id == problem_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")

    return ProblemResponse(
        id=p.id,
        title=p.title,
        source_url=p.source_url,
        statement=p.statement,
        input_format=p.input_format,
        output_format=p.output_format,
        constraints=p.constraints,
        examples=[TestCaseSchema(**ex) for ex in json.loads(p.examples_json or "[]")],
        parser_confidence=p.parser_confidence,
        created_at=p.created_at,
        updated_at=p.updated_at
    )

@router.put("/{problem_id}", response_model=ProblemResponse)
async def update_problem(problem_id: int, req: ProblemUpdateRequest, db: Session = Depends(get_db)):
    p = db.query(Problem).filter(Problem.id == problem_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")

    if req.title is not None:
        p.title = req.title
    if req.statement is not None:
        p.statement = req.statement
    if req.input_format is not None:
        p.input_format = req.input_format
    if req.output_format is not None:
        p.output_format = req.output_format
    if req.constraints is not None:
        p.constraints = req.constraints
    if req.examples is not None:
        p.examples_json = json.dumps([ex.dict() for ex in req.examples])

    db.commit()
    db.refresh(p)

    return ProblemResponse(
        id=p.id,
        title=p.title,
        source_url=p.source_url,
        statement=p.statement,
        input_format=p.input_format,
        output_format=p.output_format,
        constraints=p.constraints,
        examples=[TestCaseSchema(**ex) for ex in json.loads(p.examples_json or "[]")],
        parser_confidence=p.parser_confidence,
        created_at=p.created_at,
        updated_at=p.updated_at
    )
