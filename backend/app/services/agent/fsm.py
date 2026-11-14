"""
Finite State Machine Engine for CodeChef Copilot Autonomous Agent
Validates and enforces strict server-side transitions according to specification.
"""
from typing import Dict, List, Optional, Set
import hashlib
import secrets
import datetime
from fastapi import HTTPException

VALID_STATES: Set[str] = {
    "DISCOVERED",
    "NEEDS_PERMISSION_CONFIRMATION",
    "QUEUED",
    "OPENING_PROBLEM",
    "PARSING_PROBLEM",
    "NEEDS_PROBLEM_REVIEW",
    "ANALYZING",
    "DRAFTING",
    "COMPILING",
    "TESTING",
    "DEBUGGING",
    "READY_FOR_REVIEW",
    "NEEDS_SUBMISSION_PERMISSION",
    "NEEDS_SUBMISSION_CONFIRMATION",
    "SUBMITTING",
    "VERIFYING_VERDICT",
    "COMPLETED",
    "FAILED",
    "PAUSED",
    "CANCELLED",
}

TERMINAL_STATES: Set[str] = {"COMPLETED", "CANCELLED"}

VALID_TRANSITIONS: Dict[str, List[str]] = {
    "DISCOVERED": ["NEEDS_PERMISSION_CONFIRMATION", "QUEUED", "CANCELLED"],
    "NEEDS_PERMISSION_CONFIRMATION": ["QUEUED", "CANCELLED", "PAUSED"],
    "QUEUED": ["OPENING_PROBLEM", "ANALYZING", "PAUSED", "CANCELLED"],
    "OPENING_PROBLEM": ["PARSING_PROBLEM", "FAILED", "PAUSED", "CANCELLED"],
    "PARSING_PROBLEM": ["NEEDS_PROBLEM_REVIEW", "ANALYZING", "FAILED", "PAUSED", "CANCELLED"],
    "NEEDS_PROBLEM_REVIEW": ["ANALYZING", "PAUSED", "CANCELLED", "FAILED"],
    "ANALYZING": ["DRAFTING", "READY_FOR_REVIEW", "FAILED", "PAUSED", "CANCELLED"],
    "DRAFTING": ["COMPILING", "READY_FOR_REVIEW", "FAILED", "PAUSED", "CANCELLED"],
    "COMPILING": ["TESTING", "DEBUGGING", "FAILED", "PAUSED", "CANCELLED"],
    "TESTING": ["READY_FOR_REVIEW", "DEBUGGING", "FAILED", "PAUSED", "CANCELLED"],
    "DEBUGGING": ["DRAFTING", "COMPILING", "FAILED", "PAUSED", "CANCELLED"],
    "READY_FOR_REVIEW": ["NEEDS_SUBMISSION_PERMISSION", "NEEDS_SUBMISSION_CONFIRMATION", "COMPLETED", "FAILED", "PAUSED", "CANCELLED"],
    "NEEDS_SUBMISSION_PERMISSION": ["NEEDS_SUBMISSION_CONFIRMATION", "READY_FOR_REVIEW", "PAUSED", "CANCELLED"],
    "NEEDS_SUBMISSION_CONFIRMATION": ["SUBMITTING", "READY_FOR_REVIEW", "PAUSED", "CANCELLED"],
    "SUBMITTING": ["VERIFYING_VERDICT", "FAILED", "PAUSED", "CANCELLED"],
    "VERIFYING_VERDICT": ["COMPLETED", "FAILED", "PAUSED", "CANCELLED"],
    "PAUSED": [
        "QUEUED", "OPENING_PROBLEM", "PARSING_PROBLEM", "ANALYZING",
        "DRAFTING", "COMPILING", "TESTING", "DEBUGGING",
        "READY_FOR_REVIEW", "NEEDS_SUBMISSION_PERMISSION",
        "NEEDS_SUBMISSION_CONFIRMATION", "SUBMITTING", "CANCELLED"
    ],
    "FAILED": ["QUEUED", "ANALYZING", "DRAFTING", "COMPILING", "TESTING", "CANCELLED"],
    "COMPLETED": [],
    "CANCELLED": [],
}

class FSMValidator:
    @staticmethod
    def validate_transition(current_state: str, next_state: str) -> bool:
        if current_state not in VALID_STATES or next_state not in VALID_STATES:
            return False
        if current_state == next_state:
            return True
        allowed = VALID_TRANSITIONS.get(current_state, [])
        return next_state in allowed

    @classmethod
    def transition(cls, current_state: str, next_state: str) -> str:
        if not cls.validate_transition(current_state, next_state):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid FSM transition: cannot move from {current_state} to {next_state}"
            )
        return next_state

class SubmissionTokenStore:
    """
    Manages short-lived, single-use submission confirmation tokens.
    Cryptographically tied to task_id, draft_id, code_hash, and destination_url.
    Expires in 300 seconds (5 minutes). Re-use or code mutation invalidates immediately.
    """
    _tokens: Dict[str, Dict] = {}

    @classmethod
    def compute_code_hash(cls, source_code: str) -> str:
        return hashlib.sha256(source_code.encode("utf-8")).hexdigest()

    @classmethod
    def create_token(
        cls,
        task_id: int,
        draft_id: int,
        source_code: str,
        destination_url: str
    ) -> Dict:
        # Purge expired tokens
        cls._cleanup()

        token_str = secrets.token_urlsafe(32)
        code_hash = cls.compute_code_hash(source_code)
        now = datetime.datetime.utcnow()
        expires_at = now + datetime.timedelta(seconds=300)

        record = {
            "token": token_str,
            "task_id": task_id,
            "draft_id": draft_id,
            "code_hash": code_hash,
            "destination_url": destination_url,
            "created_at": now,
            "expires_at": expires_at,
            "used": False,
        }
        cls._tokens[token_str] = record
        return record

    @classmethod
    def verify_and_consume(
        cls,
        token_str: str,
        task_id: int,
        draft_id: int,
        current_source_code: str,
        destination_url: str
    ) -> Dict:
        cls._cleanup()
        record = cls._tokens.get(token_str)
        if not record:
            raise HTTPException(
                status_code=400,
                detail="Invalid submission confirmation token. Please request a fresh submission review."
            )

        if record["used"]:
            raise HTTPException(
                status_code=400,
                detail="This submission confirmation token has already been used. Duplicate submissions are strictly prevented."
            )

        if datetime.datetime.utcnow() > record["expires_at"]:
            raise HTTPException(
                status_code=400,
                detail="Submission confirmation token has expired (5-minute TTL). Please review and generate a fresh confirmation."
            )

        if record["task_id"] != task_id or record["draft_id"] != draft_id:
            raise HTTPException(
                status_code=400,
                detail="Submission token does not match the active task or draft."
            )

        current_hash = cls.compute_code_hash(current_source_code)
        if record["code_hash"] != current_hash:
            raise HTTPException(
                status_code=400,
                detail="Code has changed since submission preparation. Token invalidated. Please review and confirm the new code."
            )

        # Mark as consumed immediately
        record["used"] = True
        return record

    @classmethod
    def _cleanup(cls):
        now = datetime.datetime.utcnow()
        expired = [k for k, v in cls._tokens.items() if now > v["expires_at"]]
        for k in expired:
            cls._tokens.pop(k, None)
