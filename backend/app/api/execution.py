import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.execution import ExecutionRun
from app.schemas.execution import ExecutionRequest, ExecutionResponse, TestResultOutput
from app.services.execution.runner import ExecutionRunner

router = APIRouter(prefix="/api/execution", tags=["execution"])

@router.post("/run", response_model=ExecutionResponse)
async def run_code(req: ExecutionRequest, db: Session = Depends(get_db)):
    # Create preliminary record
    run = ExecutionRun(
        draft_id=req.draft_id,
        status="running",
        compile_stdout="",
        compile_stderr="",
        test_results_json="[]",
        duration_ms=0.0
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    # Execute isolated container runner
    exec_res = ExecutionRunner.run_cpp(
        source_code=req.source_code,
        tests=req.tests,
        run_id=run.id
    )

    # Update database record
    run.status = exec_res.status
    run.compile_stdout = exec_res.compile_stdout
    run.compile_stderr = exec_res.compile_stderr
    run.test_results_json = json.dumps([t.dict() for t in exec_res.results])
    run.duration_ms = exec_res.duration_ms
    db.commit()

    return exec_res

@router.get("/{run_id}", response_model=ExecutionResponse)
async def get_execution_run(run_id: int, db: Session = Depends(get_db)):
    run = db.query(ExecutionRun).filter(ExecutionRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Execution run not found")

    results_data = json.loads(run.test_results_json or "[]")
    results = [TestResultOutput(**item) for item in results_data]

    return ExecutionResponse(
        run_id=run.id,
        status=run.status,
        compile_stdout=run.compile_stdout,
        compile_stderr=run.compile_stderr,
        results=results,
        duration_ms=run.duration_ms,
        is_docker_isolated=(run.status != "docker_unavailable"),
        message=f"Execution completed with status: {run.status}"
    )
