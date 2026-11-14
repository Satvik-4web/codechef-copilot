# CodeChef Copilot Troubleshooting Guide

## 1. Browser Issues

### Dedicated Browser Fails to Launch
- **Cause**: Playwright Chromium binary not installed or browser process locked.
- **Resolution**:
  ```powershell
  # Inside backend/venv
  python -m playwright install chromium
  ```
  If another process is using `.codechef_profile`, close any existing Chromium windows or remove the lockfile in `.codechef_profile/`.

### CAPTCHA or Cloudflare Challenge Appears
- **Cause**: CodeChef or Cloudflare bot-mitigation triggers a verification challenge.
- **Resolution**: CodeChef Copilot automatically detects the challenge and pauses automation. Switch to the open Chromium window, complete the challenge or login manually, and then click **Capture** in the Copilot app.

---

## 2. Docker & Code Execution Issues

### "Docker Sandbox Offline" / "Docker daemon is not running"
- **Cause**: Docker Desktop is installed but the daemon service is stopped.
- **Resolution**:
  1. Open **Docker Desktop** from the Windows Start menu.
  2. Wait until the Docker whale icon in the Windows taskbar turns steady (green).
  3. Pre-build the lightweight C++17 execution image:
     ```powershell
     cd d:\metahackathon\codechef-copilot
     docker compose build
     ```
  4. Return to CodeChef Copilot and click **Run Isolated Tests**.

### Compilation Timeout
- **Cause**: Code exceeds compiler resource limits or includes excessively deep template recursion.
- **Resolution**: Verify that standard competitive programming headers are used (`#include <iostream>`, `#include <vector>`).

---

## 3. Problem Parser Issues

### Incomplete Problem Extraction or Low Confidence Score
- **Cause**: CodeChef occasionally runs experiments with alternative problem statement DOM structures.
- **Resolution**:
  1. Click the **Manual Task** button in the header bar, or click the **Edit** icon next to the problem title.
  2. Paste the problem statement, input/output specifications, or sample test cases directly into the modal.
  3. Click **Save & Use Problem**. The workspace will immediately reflect your input.

---

## 4. AI Provider & Key Issues

### Offline Rule-Based Guidance
- If `AI_PROVIDER` and `AI_API_KEY` are omitted in `.env`, CodeChef Copilot automatically operates using its built-in offline educational engine. Explanations, graduated hints, complexity breakdowns, and debugging advice remain 100% functional without an internet AI key.
- To configure an external provider (optional):
  ```env
  AI_PROVIDER=gemini
  AI_API_KEY=your_gemini_api_key_here
  AI_MODEL=gemini-1.5-flash
  ```
