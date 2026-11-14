# CodeChef Copilot — Autonomous Coding Agent

> **A local-first, supervised, browser-assisted coding agent for CodeChef practice tasks and authorized assignments.**  
> Transparent, secure, and rigorously compliant with academic integrity and platform rules.

---

## 1. Product Vision & Principles

CodeChef Copilot combines interactive learning guidance with a **supervised, finite-state autonomous agent** that can scan assignment pages, queue authorized practice tasks, analyze problem statements, generate C++17 implementations, run isolated Docker test runs, perform bounded self-debugging, and guide you through verified submissions:

- **Strict Integrity Boundaries**: All newly discovered tasks default to `assistance_status="unknown"` and `task_mode="learning"`. Ready-to-submit code generation is strictly prohibited until explicit per-task user confirmation is provided.
- **Two-Step Submission Gating**: Automated submission is disabled by default (`automated_submission_allowed=False`). When enabled, it generates a fresh, short-lived (5-minute TTL), single-use cryptographic token (`/submission/prepare` $\rightarrow$ `/submission/confirm`) bound to the SHA-256 hash of the code, task ID, and destination URL. Modifying the code instantly invalidates the token.
- **Dedicated Browser Profile**: Runs Chromium with an isolated profile (`.codechef_profile`). Your everyday browser profile and credentials are never touched. You log in manually in the visible browser window.
- **Safe Docker Execution**: C++17 code runs inside an unprivileged Docker container with no network access (`--network none`) and strict 256MB RAM caps. If Docker is unavailable, the runner fails closed with setup instructions rather than risking unrestricted host execution.
- **Auditable Finite State Machine (FSM)**: Manages 20 discrete operational states with validated transitions, per-step persistence, safe crash recovery, and live audit event logging.
- **Emergency Stop & Challenge Pausing**: Instantly pause individual tasks or engage a global Emergency Stop. The agent automatically halts when encountering CAPTCHAs, Cloudflare checks, or login screens.

---

## 2. Quick Start & Installation

### Prerequisites
- **Windows 10/11**
- **Python 3.10+**
- **Node.js 18+** & npm
- **Docker Desktop** (for isolated sandbox test execution)

---

### Step 1: Backend Setup

Open a Windows PowerShell terminal:

```powershell
# Navigate to backend directory
cd d:\metahackathon\codechef-copilot\backend

# Create virtual environment (if not already created)
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Install Playwright Chromium browser
python -m playwright install chromium

# Copy environment file
Copy-Item ..\.env.example .env

# Start FastAPI server (strictly bound to localhost:8000)
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The backend API will start at `http://127.0.0.1:8000`. You can verify it at `http://127.0.0.1:8000/api/health`.

---

### Step 2: Frontend Setup

Open a second Windows PowerShell terminal:

```powershell
# Navigate to frontend directory
cd d:\metahackathon\codechef-copilot\frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

The frontend will start at `http://localhost:5173`. Open this URL in your web browser.

---

### Step 3: Sandbox Setup (Optional but Recommended)

To enable isolated C++17 test execution:
1. Ensure **Docker Desktop** is running.
2. In PowerShell, build the container image:
   ```powershell
   cd d:\metahackathon\codechef-copilot
   docker compose build
   ```

*(Note: If Docker is not running, CodeChef Copilot clearly indicates that container isolation is offline and halts execution safely rather than running untrusted code on your host system).*

---

## 3. End-to-End Workflow

### 1. Launch Dedicated Browser & Log In
1. On the **Dashboard**, click **Launch Dedicated Browser**.
2. A separate Chromium browser window will open.
3. In this browser window, log into your CodeChef account manually.
   - *Never share or paste passwords or cookies into the app. Authentication happens entirely inside the visible browser window.*
   - *If CAPTCHA or Cloudflare verification appears, solve it manually; Copilot automatically detects challenges and pauses.*

### 2. Autonomous Agent Workflow (Batch & Queue)

For managing multiple assignments or practice sets under appropriate supervision:

1. **Scan Visible Page for Tasks**:
   - Navigate in the dedicated browser to any CodeChef practice page, problem listing, contest page, or assignment dashboard.
   - Go to the **Discovery** view in the UI and click **Scan Active Browser Page**.
   - The agent scans the visible DOM for problem rows, extracting titles, URLs, and visible statuses.
   - All newly discovered tasks default to **Unknown Permission** and **Learning Mode**.
2. **Review & Select Tasks**:
   - Check the tasks you want to queue and click **Add Selected to Agent Queue**.
   - The tasks transition to `NEEDS_PERMISSION_CONFIRMATION`.
3. **Configure Permissions in Agent Queue**:
   - Open the **Agent Queue** view.
   - For each task, click **Configure Permissions**:
     - Declare whether AI assistance is explicitly authorized by course or platform rules (`ai_assistance_allowed`).
     - Choose whether to enable automated submission (`automated_submission_allowed`).
     - State the task mode (`learning` or `authorized_practice`).
   - If permissions are unknown or learning-only, the agent provides algorithm hints and reviews only. If authorized practice is confirmed, full drafting and testing are enabled.
4. **Execute Supervised Pipeline**:
   - Click **Run Pipeline** on an eligible task (or use **Start Queue**).
   - The FSM manages the pipeline:
     - `OPENING_PROBLEM` $\rightarrow$ `PARSING_PROBLEM`
     - `ANALYZING` candidate algorithms and time/space complexity
     - `DRAFTING` C++17 solution in Monaco Editor
     - `COMPILING` in isolated Docker container
     - `TESTING` with sample cases and custom boundary tests
     - `DEBUGGING` with bounded self-repair iterations (max 3 repairs)
     - `READY_FOR_REVIEW` when tests pass
5. **Two-Step Submission Preparation & One-Time Confirmation**:
   - If automated submission is authorized, click **Prepare Submission**.
   - The backend validates the code and generates a short-lived (5-minute TTL) cryptographic token bound to:
     - Task ID and Draft ID
     - SHA-256 Hash of the exact code
     - Destination submission URL
   - A modal displays the confirmation token countdown, destination URL, code hash, and the 3-point integrity pledge.
   - Click **Confirm & Submit** to proceed with browser automation. If any code modification occurs before confirmation, the token is invalidated.
   - Alternatively, use **Submit Manually in Browser** to open the submission page and paste code yourself.
6. **Safety & Queue Controls**:
   - Use **Emergency Stop** (available in the top navigation bar) at any time to immediately halt all browser actions and pause the active task.
   - Use **Pause**, **Resume**, or **Cancel Task** on individual task cards.

---

### 3. Interactive Copilot Workflow (Single Problem)

1. **Capture Problem**: Navigate to a problem and click **Capture Active Problem** on the Dashboard.
2. **Work in Monaco Workspace**: Inspect problem details, write C++17 code, and run sample tests in Docker.
3. **Consult Learning Assistant**: Request graduated hints (Level 1 Intuition $\rightarrow$ Level 2 Data Structures $\rightarrow$ Level 3 Invariants), complexity analysis, or targeted code reviews.
4. **Review & Submit Guidance**: Complete the verification checklist and click **Open Submission Page in Browser** to submit manually.

---

## 4. Running Automated Tests

Run backend unit and integration test suite:

```powershell
cd d:\metahackathon\codechef-copilot\backend
.\venv\Scripts\python.exe -m pytest -v
```

Build the frontend to verify TypeScript types:

```powershell
cd d:\metahackathon\codechef-copilot\frontend
npm run build
```

---

## 5. Project Structure

```
codechef-copilot/
├── README.md
├── docs/
│   ├── upgrade-plan.md
│   ├── END_TO_END_AUDIT.md
│   └── AUTONOMOUS_AGENT_AUDIT.md
├── .env.example
├── .gitignore
├── docker-compose.yml
├── extension/
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── content.css
│   ├── sidepanel.html
│   ├── sidepanel.js
│   ├── README.md
│   └── icons/
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── types/
│       ├── services/api.ts
│       ├── components/
│       │   ├── Header.tsx
│       │   ├── ManualProblemModal.tsx
│       │   └── SubmissionGuidanceModal.tsx
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── Discovery.tsx
│       │   ├── AgentQueue.tsx
│       │   ├── Workspace.tsx
│       │   ├── History.tsx
│       │   └── Settings.tsx
│       └── features/
│           ├── editor/MonacoEditor.tsx
│           ├── assistant/AssistantPanel.tsx
│           ├── execution/TestRunnerPanel.tsx
│           └── problems/ProblemStatementPanel.tsx
├── backend/
│   ├── requirements.txt
│   ├── tests/
│   │   ├── test_agent_orchestrator.py
│   │   ├── test_api.py
│   │   ├── test_assistant.py
│   │   ├── test_execution.py
│   │   └── test_parser.py
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       ├── api/
│       │   ├── agent.py
│       │   ├── assistant.py
│       │   ├── browser.py
│       │   ├── drafts.py
│       │   ├── execution.py
│       │   ├── parser.py
│       │   └── settings.py
│       ├── models/
│       │   ├── agent.py
│       │   ├── draft.py
│       │   └── problem.py
│       ├── schemas/
│       │   ├── agent.py
│       │   ├── assistant.py
│       │   ├── browser.py
│       │   ├── draft.py
│       │   ├── execution.py
│       │   ├── parser.py
│       │   └── settings.py
│       └── services/
│           ├── agent/
│           │   ├── fsm.py
│           │   └── orchestrator.py
│           ├── browser/
│           │   ├── codechef_selectors.py
│           │   └── manager.py
│           ├── parser/
│           ├── assistant/
│           └── execution/
└── execution/
    ├── Dockerfile.cpp
    └── runner.py
```

---

## 6. Security & Integrity Guarantee

CodeChef Copilot does not:
- Store or transmit passwords, tokens, or session cookies.
- Circumvent CAPTCHAs, bot detections, or Cloudflare challenges.
- Scrape private endpoints or undocumented APIs.
- Submit code silently or without explicit manual user action.
- Execute untrusted code directly on the host machine.
