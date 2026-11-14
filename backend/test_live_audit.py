import httpx
import json
import sys

BASE_URL = "http://127.0.0.1:8000/api"

def audit_api():
    print("=== LIVE API AUDIT ===")
    client = httpx.Client(base_url=BASE_URL, timeout=15.0)

    # 1. Health
    r = client.get("/health")
    assert r.status_code == 200, f"Health check failed: {r.status_code}"
    print("[PASS] GET /api/health:", r.json())

    # 2. Settings
    r = client.get("/settings")
    assert r.status_code == 200, f"Settings failed: {r.status_code}"
    settings = r.json()
    print("[PASS] GET /api/settings:", settings)

    # 3. Settings update
    r = client.patch("/settings", json={"execution_timeout_seconds": 6})
    assert r.status_code == 200
    assert r.json()["execution_timeout_seconds"] == 6
    print("[PASS] PATCH /api/settings: updated timeout to 6s")

    # Restore timeout to 5s
    client.patch("/settings", json={"execution_timeout_seconds": 5})

    # 4. Browser status initially
    r = client.get("/browser/status")
    assert r.status_code == 200
    print("[PASS] GET /api/browser/status:", r.json())

    # 5. Problem parsing & persistence
    sample_html = """
    <html>
      <head><title>ATM2 Problem | CodeChef</title></head>
      <body>
        <div class="problem-code-container"><h1>ATM Machine Live Audit</h1></div>
        <div id="problem-statement">
          <p>There are N people in queue withdrawing money from an ATM containing K units.</p>
          <h3>Input Format</h3>
          <p>The first line has T. Each test case has N and K followed by array A.</p>
          <h3>Output Format</h3>
          <p>Output string of 1s and 0s.</p>
          <h3>Constraints</h3>
          <p>1 &le; T &le; 100, 1 &le; N, K &le; 100</p>
          <pre>1
5 10
3 5 3 2 1</pre>
          <pre>11010</pre>
        </div>
      </body>
    </html>
    """
    r = client.post("/problems/parse", json={
        "raw_html": sample_html,
        "url": "https://www.codechef.com/problems/ATM2"
    })
    assert r.status_code == 200, f"Parse failed: {r.text}"
    problem = r.json()
    problem_id = problem["id"]
    print(f"[PASS] POST /api/problems/parse: Created Problem ID {problem_id} ('{problem['title']}') with confidence {problem['parser_confidence']}")

    # 6. Get Problem & List Problems
    r = client.get(f"/problems/{problem_id}")
    assert r.status_code == 200
    assert r.json()["title"] == "ATM Machine Live Audit"
    print(f"[PASS] GET /api/problems/{problem_id}: retrieved successfully")

    r = client.get("/problems")
    assert r.status_code == 200
    assert any(p["id"] == problem_id for p in r.json())
    print(f"[PASS] GET /api/problems: returned {len(r.json())} problems")

    # 7. Update Problem
    r = client.put(f"/problems/{problem_id}", json={"title": "ATM Machine (Audited)"})
    assert r.status_code == 200
    assert r.json()["title"] == "ATM Machine (Audited)"
    print(f"[PASS] PUT /api/problems/{problem_id}: successfully updated title")

    # 8. Drafts
    r = client.post("/drafts", json={
        "problem_id": problem_id,
        "language": "cpp17",
        "source_code": "#include <iostream>\nusing namespace std;\nint main(){ return 0; }",
        "mode": "learning"
    })
    assert r.status_code == 200
    draft = r.json()
    draft_id = draft["id"]
    print(f"[PASS] POST /api/drafts: Created Draft ID {draft_id}")

    r = client.get(f"/drafts/problem/{problem_id}")
    assert r.status_code == 200
    assert r.json()["id"] == draft_id
    print(f"[PASS] GET /api/drafts/problem/{problem_id}: retrieved draft ID {draft_id}")

    r = client.put(f"/drafts/{draft_id}", json={"source_code": "// updated code"})
    assert r.status_code == 200
    assert r.json()["source_code"] == "// updated code"
    print(f"[PASS] PUT /api/drafts/{draft_id}: updated draft code")

    # 9. Assistant Endpoints
    # Explain
    r = client.post("/assistant/explain", json={"problem_id": problem_id})
    assert r.status_code == 200
    assert "Conceptual Explanation" in r.json()["message"] or len(r.json()["message"]) > 20
    print("[PASS] POST /api/assistant/explain: valid response received")

    # Hints level 1, 2, 3
    for lvl in [1, 2, 3]:
        r = client.post("/assistant/hint", json={"problem_id": problem_id, "hint_level": lvl})
        assert r.status_code == 200
        assert r.json()["hint_level"] == lvl
        print(f"[PASS] POST /api/assistant/hint (level {lvl}): {r.json()['disclaimer']}")

    # Approach
    r = client.post("/assistant/approach", json={"problem_id": problem_id})
    assert r.status_code == 200
    assert "Approach" in r.json()["message"]
    print("[PASS] POST /api/assistant/approach: valid complexity analysis")

    # Review
    r = client.post("/assistant/review", json={
        "problem_id": problem_id,
        "source_code": "int main() { int n; cin >> n; return 0; }",
        "language": "cpp17"
    })
    assert r.status_code == 200
    print("[PASS] POST /api/assistant/review: code review returned")

    # Debug
    r = client.post("/assistant/debug", json={
        "problem_id": problem_id,
        "source_code": "int main() { cin >> x; }",
        "compiler_error": "error: 'x' was not declared in this scope"
    })
    assert r.status_code == 200
    print("[PASS] POST /api/assistant/debug: error diagnosis returned")

    # Practice Solution - Gating check
    # When user_confirmed_allowed is False:
    r = client.post("/assistant/practice-solution", json={
        "problem_id": problem_id,
        "user_confirmed_allowed": False
    })
    assert r.status_code == 400
    print("[PASS] POST /api/assistant/practice-solution: correctly blocked with 400 when user_confirmed_allowed=False")

    # When user_confirmed_allowed is True:
    r = client.post("/assistant/practice-solution", json={
        "problem_id": problem_id,
        "user_confirmed_allowed": True
    })
    assert r.status_code == 200
    assert r.json()["is_ai_assisted"] is True
    print("[PASS] POST /api/assistant/practice-solution: allowed with explicit user confirmation, is_ai_assisted=True")

    # 10. Execution Runner & Fail Closed Isolation Check
    r = client.post("/execution/run", json={
        "language": "cpp17",
        "source_code": "#include <iostream>\nint main() { return 0; }",
        "tests": [{"name": "Test 1", "stdin": "", "expected_stdout": ""}],
        "draft_id": draft_id
    })
    assert r.status_code == 200
    exec_data = r.json()
    run_id = exec_data["run_id"]
    print(f"[PASS] POST /api/execution/run: Run ID {run_id}, status: {exec_data['status']}")
    if exec_data["status"] == "docker_unavailable":
        assert "strictly refuses unrestricted host execution" in exec_data["compile_stderr"]
        assert exec_data["is_docker_isolated"] is False
        print("[PASS] Safety verified: Fails closed when Docker daemon unavailable; host execution strictly refused")

    r = client.get(f"/execution/{run_id}")
    assert r.status_code == 200
    print(f"[PASS] GET /api/execution/{run_id}: run retrieved successfully")

    # 11. History
    r = client.get("/history")
    assert r.status_code == 200
    hist = r.json()
    assert len(hist["problems"]) > 0
    assert len(hist["drafts"]) > 0
    assert len(hist["runs"]) > 0
    assert len(hist["interactions"]) > 0
    print(f"[PASS] GET /api/history: retrieved {len(hist['problems'])} problems, {len(hist['drafts'])} drafts, {len(hist['runs'])} runs, {len(hist['interactions'])} interactions")

    print("\nALL LIVE REST API ENDPOINTS AUDITED & PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    audit_api()
