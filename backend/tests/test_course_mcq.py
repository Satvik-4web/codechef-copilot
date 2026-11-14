from app.services.assistant.course_mcq import solve_project_type


QUESTION = """Scenario:
Project A: Predicting whether a transaction is Fraud or Not Fraud.
Project B: Predicting the amount of rainfall tomorrow (in mm).
Project C: Predicting the weight of a newborn baby (in kg).
Question: Which projects are Classification?"""
OPTIONS = ["Project B only", "Project A and C", "Project A only", "All projects"]


def test_classification_course_question():
    assert solve_project_type(QUESTION, OPTIONS) == 2


def test_rule_rejects_unrelated_questions():
    assert solve_project_type("What is a decision tree?", OPTIONS) is None


def test_rule_rejects_ambiguous_project_descriptions():
    assert solve_project_type("Which projects are Classification?\nProject A: Predicting something.\nProject B: Predicting weight in kg.", OPTIONS) is None
