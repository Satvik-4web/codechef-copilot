import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models.problem import Problem
from app.services.assistant.service import AssistantService

# In-memory database for testing
TEST_ENGINE = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=TEST_ENGINE)

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=TEST_ENGINE)
    session = TestSession()
    problem = Problem(
        title="Sum of Two Numbers",
        statement="Calculate A + B given two integers.",
        input_format="A and B",
        output_format="Sum of A and B",
        constraints="1 <= A, B <= 1000",
        examples_json='[{"name": "Sample 1", "stdin": "2 3", "expected_stdout": "5"}]'
    )
    session.add(problem)
    session.commit()
    yield session
    session.close()

@pytest.mark.asyncio
async def test_learning_mode_hints_graduated(db_session):
    res_l1 = await AssistantService.hint(db_session, problem_id=1, current_code="", level=1)
    assert res_l1["interaction_type"] == "hint"
    assert res_l1["hint_level"] == 1
    assert "Hint 1" in res_l1["message"] or "Intuition" in res_l1["message"]

    res_l2 = await AssistantService.hint(db_session, problem_id=1, current_code="", level=2)
    assert res_l2["hint_level"] == 2

@pytest.mark.asyncio
async def test_practice_solution_requires_confirmation(db_session):
    # Without explicit confirmation, must raise HTTP 400
    with pytest.raises(HTTPException) as exc_info:
        await AssistantService.practice_solution(db_session, problem_id=1, user_confirmed_allowed=False)
    
    assert exc_info.value.status_code == 400
    assert "Academic Integrity Guard" in exc_info.value.detail

@pytest.mark.asyncio
async def test_practice_solution_with_confirmation(db_session):
    res = await AssistantService.practice_solution(db_session, problem_id=1, user_confirmed_allowed=True)
    assert res["interaction_type"] == "practice_solution"
    assert res["is_ai_assisted"] is True
    assert res["generated_code"] is not None
    assert "solve" in res["generated_code"] or "main" in res["generated_code"]
