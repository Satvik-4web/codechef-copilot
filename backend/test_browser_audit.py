import httpx
import os
import sys
import time
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000/api"

def audit_browser():
    print("=== LIVE BROWSER MANAGER AUDIT ===")
    client = httpx.Client(base_url=BASE_URL, timeout=30.0)

    # 1. Status initially
    r = client.get("/browser/status")
    assert r.status_code == 200
    print("[PASS] Initial status:", r.json())

    # 2. Launch browser
    # Test headless=True for automated testing in background, while verifying persistent profile creation
    r = client.post("/browser/launch", json={"headless": True})
    assert r.status_code == 200, f"Launch failed: {r.text}"
    launch_res = r.json()
    print("[PASS] POST /api/browser/launch:", launch_res)
    assert launch_res["running"] is True

    # 3. Verify persistent profile directory created
    profile_dir = Path("d:/metahackathon/codechef-copilot/backend/.codechef_profile")
    if not profile_dir.exists():
        profile_dir = Path("d:/metahackathon/codechef-copilot/.codechef_profile")
    assert profile_dir.exists(), f"Persistent profile dir not found at {profile_dir}"
    print(f"[PASS] Persistent profile exists on disk at: {profile_dir}")

    # 4. Check status & current page
    r = client.get("/browser/status")
    assert r.status_code == 200
    st = r.json()
    assert st["running"] is True
    print(f"[PASS] Browser running, URL: {st['current_url']}, Title: {st['current_title']}")

    r = client.get("/browser/current-page")
    assert r.status_code == 200
    cp = r.json()
    print(f"[PASS] GET /api/browser/current-page: URL={cp['url']}, Challenge={cp['is_challenge_detected']}")

    # 5. Navigate to a test HTML page or data URI simulating a CodeChef practice page
    test_problem_html = """data:text/html,<html>
    <head><title>FLOW001 Problem | CodeChef</title></head>
    <body>
        <div class="problem-code-container"><h1>Add Two Numbers</h1></div>
        <div id="problem-statement">
            <p>Shivam is the youngest programmer in the world. He is solving a problem where he needs to add two numbers A and B.</p>
            <h3>Input Format</h3>
            <p>The first line contains an integer T, the total number of test cases.</p>
            <h3>Output Format</h3>
            <p>For each test case, output one line with the sum.</p>
            <h3>Constraints</h3>
            <p>1 <= T <= 1000, 0 <= A, B <= 10000</p>
            <pre>3
1 2
100 200
10 40</pre>
            <pre>3
300
50</pre>
        </div>
    </body>
    </html>"""

    r = client.post("/browser/navigate", json={"url": test_problem_html})
    assert r.status_code == 200, f"Navigate failed: {r.text}"
    print(f"[PASS] POST /api/browser/navigate: Navigated to test problem page, title='{r.json()['title']}'")

    # 6. Capture page
    r = client.post("/browser/capture")
    assert r.status_code == 200, f"Capture failed: {r.text}"
    cap = r.json()
    print(f"[PASS] POST /api/browser/capture: Captured {len(cap['html'])} bytes of HTML. Title='{cap['title']}'")

    # 7. Parse the captured page through the parser API
    r = client.post("/problems/parse", json={
        "raw_html": cap["html"],
        "url": "https://www.codechef.com/problems/FLOW001"
    })
    assert r.status_code == 200
    parsed = r.json()
    assert "Add Two Numbers" in parsed["title"]
    assert "Shivam is the youngest" in parsed["statement"]
    assert len(parsed["examples"]) >= 1
    assert parsed["parser_confidence"] >= 0.7
    print(f"[PASS] Problem Extracted from Browser DOM: '{parsed['title']}', Confidence={parsed['parser_confidence']}")

    # 8. Close browser
    r = client.post("/browser/close")
    assert r.status_code == 200
    assert r.json()["running"] is False
    print("[PASS] POST /api/browser/close: Browser closed successfully")

    # Verify status after close
    r = client.get("/browser/status")
    assert r.json()["running"] is False
    print("[PASS] Verified browser status is offline after close")

    print("\nALL BROWSER LIFECYCLE, PROFILE PERSISTENCE & CAPTURE TESTS PASSED!")

if __name__ == "__main__":
    audit_browser()
