from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "CodeChef Copilot"

def test_parse_problem_api():
    payload = {
        "raw_html": "<h1>Test Task</h1><div id='problem-statement'><p>Statement</p></div>",
        "url": "https://www.codechef.com/problems/TEST"
    }
    response = client.post("/api/problems/parse", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Test Task"
    assert "statement" in data
    assert "parser_confidence" in data

def test_assistant_explain_api():
    payload = {
        "statement": "Given an integer N, print N * 2."
    }
    response = client.post("/api/assistant/explain", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["interaction_type"] == "explain"
    assert len(data["message"]) > 0

def test_settings_api():
    response = client.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    assert "active_mode" in data
    assert "docker_available" in data
