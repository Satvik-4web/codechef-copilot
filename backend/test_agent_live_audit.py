import httpx
import json

BASE_URL = "http://127.0.0.1:8000/api"

def audit_agent_live():
    print("=== LIVE AGENT ORCHESTRATOR & GATING AUDIT ===")
    client = httpx.Client(base_url=BASE_URL, timeout=30.0)

    # 1. Discover Tasks
    html_fixture = """
    <html><body>
      <section class="chapter-module">
        <h2>Arrays & Basic Algorithms</h2>
        <table><tbody>
          <tr>
            <td><a href="/problems/FLOW001">Add Two Numbers</a></td>
            <td>Unattempted</td>
          </tr>
          <tr>
            <td><a href="/problems/ATM2">ATM Machine</a></td>
            <td>Solved</td>
          </tr>
        </tbody></table>
      </section>
    </body></html>
    """
    r = client.post("/agent/discover", json={
        "raw_html": html_fixture,
        "source_url": "https://www.codechef.com/practice"
    })
    assert r.status_code == 200, f"Discovery failed: {r.text}"
    batch = r.json()
    batch_id = batch["id"]
    tasks = batch["tasks"]
    assert len(tasks) == 2
    print(f"[PASS] POST /api/agent/discover: Created Batch #{batch_id} with {len(tasks)} discovered tasks")

    # 2. Verify strict initial defaults
    for t in tasks:
        assert t["state"] == "DISCOVERED"
        assert t["permission"]["assistance_status"] == "unknown"
        assert t["permission"]["task_mode"] == "learning"
        assert t["permission"]["automated_submission_allowed"] is False
    print("[PASS] Strict Integrity Baseline: All tasks defaulted to unknown assistance, learning mode, auto-submit disabled")

    task1 = tasks[0]
    task1_id = task1["id"]

    # 3. Select Task for Queue
    r = client.post(f"/agent/batches/{batch_id}/tasks/select", json={"task_ids": [task1_id]})
    assert r.status_code == 200
    selected_task = r.json()[0]
    # Because permission was unknown, it transitions to NEEDS_PERMISSION_CONFIRMATION
    assert selected_task["state"] == "NEEDS_PERMISSION_CONFIRMATION"
    print(f"[PASS] POST /api/agent/batches/{batch_id}/tasks/select: Task #{task1_id} state={selected_task['state']}")

    # 4. Gating Check: Attempting submission preparation without permission must fail with 403 Forbidden
    r = client.post(f"/agent/tasks/{task1_id}/submission/prepare")
    assert r.status_code == 403
    print("[PASS] Submission Gating: /submission/prepare strictly refused with 403 when automated_submission_allowed is False")

    # 5. Update Task Permission to Authorized Practice
    r = client.post(f"/agent/tasks/{task1_id}/permission", json={
        "assistance_status": "ai_assistance_allowed",
        "automated_submission_allowed": True,
        "permission_source": "Personal practice problem verified by student",
        "task_mode": "authorized_practice"
    })
    assert r.status_code == 200
    perm = r.json()
    assert perm["assistance_status"] == "ai_assistance_allowed"
    assert perm["automated_submission_allowed"] is True
    print(f"[PASS] POST /api/agent/tasks/{task1_id}/permission: Updated to authorized_practice, auto-submit authorized")

    # 6. Verify Task transitioned to QUEUED
    r = client.get(f"/agent/tasks/{task1_id}")
    assert r.status_code == 200
    assert r.json()["state"] == "QUEUED"
    print(f"[PASS] Task transitioned to QUEUED upon permission confirmation")

    # 7. Start Autonomous Task Pipeline
    # Provide a problem record or let it parse
    p_res = client.post("/problems/parse", json={
        "raw_html": "<h1>Add Two Numbers</h1><div id='problem-statement'><p>Calculate A + B</p><h3>Input Format</h3><p>T test cases</p><h3>Output Format</h3><p>Sum</p><pre>1\n2 3</pre><pre>5</pre></div>",
        "url": task1["url"]
    })
    problem_id = p_res.json()["id"]

    # Associate problem and run pipeline
    task_update = client.get(f"/agent/tasks/{task1_id}").json()
    
    # Run pipeline
    r = client.post(f"/agent/tasks/{task1_id}/start")
    assert r.status_code == 200
    task_after_run = r.json()
    print(f"[PASS] POST /api/agent/tasks/{task1_id}/start: Pipeline executed to state={task_after_run['state']}")

    # 8. Prepare Submission Token
    r = client.post(f"/agent/tasks/{task1_id}/submission/prepare")
    assert r.status_code == 200, f"Submission prepare failed: {r.text}"
    prep = r.json()
    token = prep["confirmation_token"]
    assert len(token) > 20
    assert len(prep["code_hash"]) == 64
    assert "https://www.codechef.com/submit/FLOW001" in prep["destination_url"]
    print(f"[PASS] POST /api/agent/tasks/{task1_id}/submission/prepare: One-time token generated (Hash: {prep['code_hash'][:16]}...)")

    # 9. Verify Audit Events Logged
    r = client.get(f"/agent/tasks/{task1_id}/events")
    assert r.status_code == 200
    evts = r.json()
    assert len(evts) >= 4
    event_types = [e["event_type"] for e in evts]
    print(f"[PASS] GET /api/agent/tasks/{task1_id}/events: Retrieved {len(evts)} audit events ({', '.join(event_types[:4])}...)")

    # 10. Emergency Stop
    r = client.post("/agent/queue/stop")
    assert r.status_code == 200
    print("[PASS] POST /api/agent/queue/stop: Emergency stop engaged successfully")

    print("\nALL LIVE AUTONOMOUS AGENT ORCHESTRATOR & GATING AUDITS PASSED!")

if __name__ == "__main__":
    audit_agent_live()
