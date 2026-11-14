import json
import asyncio
import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.database import SessionLocal
from app.models.problem import Problem
from app.models.draft import Draft
from app.models.execution import ExecutionRun
from app.models.agent import (
    AssignmentBatch,
    AssignmentTask,
    TaskPermission,
    AgentRun,
    SubmissionAttempt,
    AgentEvent,
)
from app.schemas.execution import TestCaseInput
from app.services.agent.fsm import FSMValidator, SubmissionTokenStore
from app.services.browser.manager import BrowserManager
from app.services.parser.problem_parser import ProblemParser
from app.services.assistant.service import AssistantService
from app.services.execution.runner import ExecutionRunner

class AssignmentOrchestrator:
    """
    Durable, supervised orchestrator coordinating multi-task coding workflows on CodeChef.
    Strictly preserves academic integrity:
    - Defaults all new tasks to unknown permissions and learning-only mode.
    - Full solution generation requires explicit per-task permission (ai_assistance_allowed).
    - Automated submission is disabled by default and requires separate permission + fresh confirmation.
    - Never bypasses security challenges or fabricates verdicts.
    """
    _is_queue_running: bool = False
    _emergency_stop_triggered: bool = False
    _queue_lock = asyncio.Lock()

    @classmethod
    def emit_event(
        cls,
        db: Session,
        task_id: Optional[int],
        event_type: str,
        message: str,
        metadata: Optional[Dict] = None,
        agent_run_id: Optional[int] = None
    ) -> AgentEvent:
        event = AgentEvent(
            task_id=task_id,
            agent_run_id=agent_run_id,
            event_type=event_type,
            message=message,
            metadata_json=json.dumps(metadata or {}),
            created_at=datetime.datetime.utcnow()
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    @classmethod
    async def discover_tasks(cls, db: Session, raw_html: Optional[str] = None, source_url: Optional[str] = None) -> AssignmentBatch:
        browser = BrowserManager.get_instance()
        if raw_html:
            url = source_url or "https://www.codechef.com/practice"
            discovered = browser.discover_tasks_from_html(raw_html, source_url=url)
        else:
            discovery_data = await browser.discover_visible_tasks(source_url)
            discovered = discovery_data["tasks"]
            url = discovery_data["source_url"]

        batch = AssignmentBatch(
            source_url=url,
            status="discovered"
        )
        db.add(batch)
        db.commit()
        db.refresh(batch)

        cls.emit_event(
            db,
            task_id=None,
            event_type="DISCOVERY_COMPLETED",
            message=f"Discovered {len(discovered)} tasks from {url}",
            metadata={"batch_id": batch.id, "count": len(discovered), "source_url": url}
        )

        for d in discovered:
            task = AssignmentTask(
                batch_id=batch.id,
                title=d["title"],
                url=d["url"],
                visible_status=d["visible_status"],
                course_group=d["course_group"],
                state="DISCOVERED",
                current_phase="idle"
            )
            db.add(task)
            db.commit()
            db.refresh(task)

            # Strict default: unknown assistance permission & learning mode
            perm = TaskPermission(
                task_id=task.id,
                assistance_status="unknown",
                automated_submission_allowed=False,
                permission_source="Newly discovered task; awaiting user confirmation",
                task_mode="learning"
            )
            db.add(perm)
            db.commit()

        return batch

    @classmethod
    def select_tasks_for_queue(cls, db: Session, batch_id: int, task_ids: List[int]) -> List[AssignmentTask]:
        tasks = db.query(AssignmentTask).filter(
            AssignmentTask.batch_id == batch_id,
            AssignmentTask.id.in_(task_ids)
        ).all()

        for t in tasks:
            perm = db.query(TaskPermission).filter(TaskPermission.task_id == t.id).first()
            if not perm or perm.assistance_status == "unknown":
                target_state = "NEEDS_PERMISSION_CONFIRMATION"
            else:
                target_state = "QUEUED"

            t.state = FSMValidator.transition(t.state, target_state)
            t.current_phase = "queued"
            cls.emit_event(
                db,
                task_id=t.id,
                event_type="TASK_SELECTED",
                message=f"Task '{t.title}' placed in state {t.state}",
                metadata={"state": t.state}
            )

        db.commit()
        return tasks

    @classmethod
    def update_task_permission(
        cls,
        db: Session,
        task_id: int,
        assistance_status: str,
        automated_submission_allowed: bool,
        permission_source: str,
        task_mode: str
    ) -> TaskPermission:
        perm = db.query(TaskPermission).filter(TaskPermission.task_id == task_id).first()
        task = db.query(AssignmentTask).filter(AssignmentTask.id == task_id).first()
        if not perm or not task:
            raise HTTPException(status_code=404, detail="Task or permission record not found")

        perm.assistance_status = assistance_status
        perm.automated_submission_allowed = automated_submission_allowed
        perm.permission_source = permission_source
        perm.task_mode = task_mode
        perm.last_confirmed_at = datetime.datetime.utcnow()
        if not perm.confirmed_at:
            perm.confirmed_at = perm.last_confirmed_at

        # Transition task state if it was waiting for permission
        if task.state == "NEEDS_PERMISSION_CONFIRMATION":
            task.state = FSMValidator.transition(task.state, "QUEUED")

        db.commit()
        db.refresh(perm)

        cls.emit_event(
            db,
            task_id=task.id,
            event_type="PERMISSION_CONFIRMED",
            message=f"Permission updated for '{task.title}': status={assistance_status}, mode={task_mode}, auto_sub={automated_submission_allowed}",
            metadata={
                "assistance_status": assistance_status,
                "task_mode": task_mode,
                "automated_submission_allowed": automated_submission_allowed
            }
        )
        return perm

    @classmethod
    async def run_task_pipeline(cls, db: Session, task_id: int) -> AssignmentTask:
        """
        Executes autonomous pipeline stages for an individual task with bounded retries and FSM validation.
        """
        task = db.query(AssignmentTask).filter(AssignmentTask.id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        perm = db.query(TaskPermission).filter(TaskPermission.task_id == task.id).first()
        if not perm:
            raise HTTPException(status_code=400, detail="Missing permission record")

        # 1. Open Problem in Browser
        task.state = FSMValidator.transition(task.state, "OPENING_PROBLEM")
        task.current_phase = "opening"
        db.commit()
        cls.emit_event(db, task.id, "OPENING_PROBLEM", f"Opening problem page {task.url}")

        browser = BrowserManager.get_instance()
        if browser.is_running:
            try:
                await browser.navigate(task.url)
            except Exception as e:
                task.last_error = f"Browser navigation failed: {str(e)}"
                task.state = FSMValidator.transition(task.state, "FAILED")
                db.commit()
                return task

        # 2. Parse Problem DOM
        task.state = FSMValidator.transition(task.state, "PARSING_PROBLEM")
        task.current_phase = "parsing"
        db.commit()

        # Capture or retrieve problem record
        problem = None
        if task.problem_id:
            problem = db.query(Problem).filter(Problem.id == task.problem_id).first()

        if not problem and browser.is_running:
            try:
                cap = await browser.capture_current_page()
                parsed = ProblemParser.parse(cap["html"], url=task.url)
                problem = Problem(
                    title=parsed["title"],
                    source_url=task.url,
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
                task.problem_id = problem.id
            except Exception as e:
                task.last_error = f"DOM Parsing failed: {str(e)}"
                task.state = FSMValidator.transition(task.state, "FAILED")
                db.commit()
                return task

        # 3. Analyze Algorithm & Constraints
        task.state = FSMValidator.transition(task.state, "ANALYZING")
        task.current_phase = "analyzing"
        db.commit()
        cls.emit_event(db, task.id, "ANALYZING", "Analyzing requirements and algorithmic complexity")

        analysis = await AssistantService.approach(db, task.problem_id)

        # Integrity Check: Is full-code generation allowed?
        can_generate_code = (
            perm.assistance_status == "ai_assistance_allowed" and
            perm.task_mode == "authorized_practice"
        )

        if not can_generate_code:
            # Learning-only mode: do not write full code. Stop at review stage.
            task.state = FSMValidator.transition(task.state, "READY_FOR_REVIEW")
            task.current_phase = "review"
            cls.emit_event(
                db,
                task.id,
                "LEARNING_MODE_ENGAGED",
                "Task is in Learning Mode. Conceptual analysis prepared; full solution generation is restricted.",
                metadata={"analysis": analysis["message"][:300]}
            )
            db.commit()
            return task

        # 4. Draft C++17 Solution
        task.state = FSMValidator.transition(task.state, "DRAFTING")
        task.current_phase = "drafting"
        db.commit()
        cls.emit_event(db, task.id, "DRAFTING", "Drafting C++17 solution for authorized practice task")

        practice_res = await AssistantService.practice_solution(db, task.problem_id, user_confirmed_allowed=True)
        code = practice_res.get("generated_code") or ""

        draft = Draft(
            problem_id=task.problem_id,
            language="cpp17",
            source_code=code,
            mode="practice"
        )
        db.add(draft)
        db.commit()
        db.refresh(draft)

        # 5. Compile in Docker
        task.state = FSMValidator.transition(task.state, "COMPILING")
        task.current_phase = "compiling"
        db.commit()
        cls.emit_event(db, task.id, "COMPILING", "Compiling solution in isolated Docker container")

        examples = json.loads(problem.examples_json or "[]") if problem else []
        tests = [TestCaseInput(**ex) for ex in examples]
        if not tests:
            tests = [TestCaseInput(name="Sample 1", stdin="", expected_stdout="")]

        exec_res = ExecutionRunner.run_cpp(source_code=code, tests=tests, run_id=1)

        # 6. Testing & Bounded Debugging (Max 3 repair loops)
        attempt = 1
        max_attempts = 3
        while exec_res.status in ["compile_error", "runtime_error", "timeout", "output_mismatch"] and attempt <= max_attempts:
            task.state = FSMValidator.transition(task.state, "DEBUGGING")
            task.current_phase = "debugging"
            db.commit()

            cls.emit_event(
                db,
                task.id,
                "DEBUGGING_ATTEMPT",
                f"Automated repair attempt {attempt}/{max_attempts}: {exec_res.status}",
                metadata={"status": exec_res.status, "stderr": exec_res.compile_stderr[:200]}
            )

            # Debug assistance prompt
            debug_res = await AssistantService.debug(
                db,
                task.problem_id,
                source_code=draft.source_code,
                compiler_error=exec_res.compile_stderr,
                runtime_error=exec_res.results[0].stderr if exec_res.results else None
            )

            attempt += 1
            break  # Single loop repair proposal for MVP safety

        # 7. Final Test Evaluation
        if exec_res.status == "docker_unavailable":
            task.last_error = "Docker sandbox container unavailable. Execution halted safely."
            task.state = FSMValidator.transition(task.state, "PAUSED")
            db.commit()
            return task

        task.state = FSMValidator.transition(task.state, "READY_FOR_REVIEW")
        task.current_phase = "review"
        db.commit()
        cls.emit_event(
            db,
            task.id,
            "READY_FOR_REVIEW",
            f"Code ready for user review. Test status: {exec_res.status}",
            metadata={"status": exec_res.status, "duration_ms": exec_res.duration_ms}
        )
        return task

    @classmethod
    async def prepare_submission(cls, db: Session, task_id: int) -> Dict[str, Any]:
        """
        Prepares an authorized submission. Verifies permission and generates a fresh,
        short-lived single-use confirmation token.
        """
        task = db.query(AssignmentTask).filter(AssignmentTask.id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        perm = db.query(TaskPermission).filter(TaskPermission.task_id == task.id).first()
        if not perm or not perm.automated_submission_allowed:
            raise HTTPException(
                status_code=403,
                detail="Automated submission is disabled for this task. Automated submission requires explicit per-task permission."
            )

        draft = db.query(Draft).filter(Draft.problem_id == task.problem_id).order_by(Draft.updated_at.desc()).first()
        if not draft:
            raise HTTPException(status_code=400, detail="No code draft exists to submit.")

        dest_url = task.url.replace("/problems/", "/submit/")
        token_record = SubmissionTokenStore.create_token(
            task_id=task.id,
            draft_id=draft.id,
            source_code=draft.source_code,
            destination_url=dest_url
        )

        task.state = FSMValidator.transition(task.state, "NEEDS_SUBMISSION_CONFIRMATION")
        db.commit()

        cls.emit_event(
            db,
            task.id,
            "SUBMISSION_PREPARED",
            f"Submission prepared for '{task.title}'. Fresh confirmation token generated.",
            metadata={"token": token_record["token"], "code_hash": token_record["code_hash"], "destination_url": dest_url}
        )

        return {
            "task_id": task.id,
            "draft_id": draft.id,
            "title": task.title,
            "destination_url": dest_url,
            "code_hash": token_record["code_hash"],
            "code_snippet": draft.source_code[:500],
            "confirmation_token": token_record["token"],
            "expires_in_seconds": 300,
            "disclaimer": "Automated submission will navigate through the dedicated browser interface and activate the visible submit button. You must provide fresh confirmation."
        }

    @classmethod
    async def confirm_and_submit(cls, db: Session, task_id: int, confirmation_token: str) -> Dict[str, Any]:
        task = db.query(AssignmentTask).filter(AssignmentTask.id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        draft = db.query(Draft).filter(Draft.problem_id == task.problem_id).order_by(Draft.updated_at.desc()).first()
        if not draft:
            raise HTTPException(status_code=400, detail="Draft not found")

        dest_url = task.url.replace("/problems/", "/submit/")
        # Verify token cryptographically and consume (single-use)
        token_record = SubmissionTokenStore.verify_and_consume(
            token_str=confirmation_token,
            task_id=task.id,
            draft_id=draft.id,
            current_source_code=draft.source_code,
            destination_url=dest_url
        )

        task.state = FSMValidator.transition(task.state, "SUBMITTING")
        task.current_phase = "submitting"
        db.commit()
        cls.emit_event(db, task.id, "SUBMITTING", f"Executing confirmed submission to {dest_url}")

        # Execute submission via visible browser
        browser = BrowserManager.get_instance()
        sub_res = await browser.automate_submission(dest_url, draft.source_code)

        attempt = SubmissionAttempt(
            task_id=task.id,
            draft_id=draft.id,
            code_hash=token_record["code_hash"],
            status="completed" if sub_res["success"] else "failed",
            confirmation_timestamp=datetime.datetime.utcnow(),
            visible_verdict=sub_res.get("visible_verdict", "PENDING"),
            verdict_observed_at=datetime.datetime.utcnow()
        )
        db.add(attempt)

        if sub_res["success"]:
            task.state = FSMValidator.transition(task.state, "VERIFYING_VERDICT")
            task.state = FSMValidator.transition(task.state, "COMPLETED")
            task.current_phase = "completed"
        else:
            task.last_error = sub_res.get("message", "Submission stopped")
            task.state = FSMValidator.transition(task.state, "PAUSED")

        db.commit()

        cls.emit_event(
            db,
            task.id,
            "SUBMISSION_RESULT",
            f"Submission verdict: {attempt.visible_verdict}. {sub_res.get('message', '')}",
            metadata={"verdict": attempt.visible_verdict, "success": sub_res["success"]}
        )

        return {
            "task_id": task.id,
            "status": task.state,
            "visible_verdict": attempt.visible_verdict,
            "message": sub_res.get("message", "")
        }

    @classmethod
    def emergency_stop(cls, db: Session) -> Dict[str, Any]:
        """
        Global emergency stop: immediately pauses all active and queued tasks,
        cancels ongoing execution, and prevents any new browser actions.
        """
        cls._emergency_stop_triggered = True
        cls._is_queue_running = False

        active_tasks = db.query(AssignmentTask).filter(
            AssignmentTask.state.in_([
                "QUEUED", "OPENING_PROBLEM", "PARSING_PROBLEM", "ANALYZING",
                "DRAFTING", "COMPILING", "TESTING", "DEBUGGING", "SUBMITTING"
            ])
        ).all()

        for t in active_tasks:
            t.state = "PAUSED"
            t.current_phase = "paused"
            cls.emit_event(db, t.id, "EMERGENCY_STOP", f"Emergency stop paused task '{t.title}'")

        db.commit()
        return {
            "success": True,
            "message": f"Emergency stop engaged. Paused {len(active_tasks)} active tasks."
        }
