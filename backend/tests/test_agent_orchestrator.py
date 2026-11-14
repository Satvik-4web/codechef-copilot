import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models.agent import AssignmentBatch, AssignmentTask, TaskPermission
from app.services.agent.fsm import FSMValidator, SubmissionTokenStore

TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=TEST_ENGINE)
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)
    app.dependency_overrides.pop(get_db, None)

client = TestClient(app)

def test_fsm_valid_and_invalid_transitions():
    assert FSMValidator.validate_transition("DISCOVERED", "QUEUED") is True
    assert FSMValidator.validate_transition("QUEUED", "ANALYZING") is True
    assert FSMValidator.validate_transition("DRAFTING", "COMPILING") is True
    assert FSMValidator.validate_transition("COMPILING", "TESTING") is True
    assert FSMValidator.validate_transition("TESTING", "READY_FOR_REVIEW") is True
    
    # Invalid transition (e.g. jumping from DISCOVERED directly to SUBMITTING)
    assert FSMValidator.validate_transition("DISCOVERED", "SUBMITTING") is False
    with pytest.raises(Exception):
        FSMValidator.transition("DISCOVERED", "SUBMITTING")

def test_task_discovery_defaults_to_unknown_and_learning():
    html_fixture = """
    <html><body>
      <table><tbody>
        <tr><td><a href="/problems/FLOW001">Add Two Numbers</a></td><td>Unattempted</td></tr>
        <tr><td><a href="/problems/ATM2">ATM Machine</a></td><td>Solved</td></tr>
      </tbody></table>
    </body></html>
    """
    res = client.post("/api/agent/discover", json={"raw_html": html_fixture, "source_url": "https://www.codechef.com/practice"})
    assert res.status_code == 200
    batch = res.json()
    assert len(batch["tasks"]) == 2

    for t in batch["tasks"]:
        assert t["state"] == "DISCOVERED"
        assert t["permission"]["assistance_status"] == "unknown"
        assert t["permission"]["task_mode"] == "learning"
        assert t["permission"]["automated_submission_allowed"] is False

def test_permission_update_and_practice_gating():
    db = TestingSessionLocal()
    batch = AssignmentBatch(source_url="https://www.codechef.com")
    db.add(batch)
    db.commit()

    task = AssignmentTask(
        batch_id=batch.id,
        title="Test Task",
        url="https://www.codechef.com/problems/TEST",
        state="DISCOVERED"
    )
    db.add(task)
    db.commit()

    perm = TaskPermission(
        task_id=task.id,
        assistance_status="unknown",
        automated_submission_allowed=False,
        task_mode="learning"
    )
    db.add(perm)
    db.commit()

    # Update permission to authorized_practice
    res = client.post(f"/api/agent/tasks/{task.id}/permission", json={
        "assistance_status": "ai_assistance_allowed",
        "automated_submission_allowed": True,
        "permission_source": "Personal practice problem verified by student",
        "task_mode": "authorized_practice"
    })
    assert res.status_code == 200
    updated_perm = res.json()
    assert updated_perm["assistance_status"] == "ai_assistance_allowed"
    assert updated_perm["automated_submission_allowed"] is True
    assert updated_perm["task_mode"] == "authorized_practice"

def test_submission_token_expiration_and_invalidation():
    code = "int main() { return 0; }"
    token_record = SubmissionTokenStore.create_token(
        task_id=1,
        draft_id=10,
        source_code=code,
        destination_url="https://www.codechef.com/submit/TEST"
    )
    token = token_record["token"]
    assert len(token) > 20

    # Token invalidation on code alteration
    changed_code = "int main() { return 1; }"
    with pytest.raises(Exception) as exc:
        SubmissionTokenStore.verify_and_consume(
            token_str=token,
            task_id=1,
            draft_id=10,
            current_source_code=changed_code,
            destination_url="https://www.codechef.com/submit/TEST"
        )
    assert "Code has changed" in str(exc.value.detail)

    # Successful consume
    token_record_2 = SubmissionTokenStore.create_token(
        task_id=2,
        draft_id=20,
        source_code=code,
        destination_url="https://www.codechef.com/submit/TEST2"
    )
    consumed = SubmissionTokenStore.verify_and_consume(
        token_str=token_record_2["token"],
        task_id=2,
        draft_id=20,
        current_source_code=code,
        destination_url="https://www.codechef.com/submit/TEST2"
    )
    assert consumed["used"] is True

    # Prevent re-use (single-use token)
    with pytest.raises(Exception) as exc_reuse:
        SubmissionTokenStore.verify_and_consume(
            token_str=token_record_2["token"],
            task_id=2,
            draft_id=20,
            current_source_code=code,
            destination_url="https://www.codechef.com/submit/TEST2"
        )
    assert "already been used" in str(exc_reuse.value.detail)
