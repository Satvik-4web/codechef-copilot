# Safety, Academic Integrity & Platform Policy Guide

CodeChef Copilot is built strictly as an **educational companion**, not a cheating tool or automated solver. The following rules are hard-coded into backend logic and user interface workflows.

---

## 1. Zero Automated Submission
- **Manual Submission Only**: CodeChef Copilot intentionally omits any automated submission buttons, background POST requests, or DOM click automation for submissions.
- **Review Checklist**: Before navigating to the CodeChef submission interface, the user must review and confirm a 3-point checklist verifying code comprehension, rule compliance, and edge-case testing.
- **User Accountability**: The platform opens the problem's submission page in the dedicated browser, where the user reviews the code and submits manually.

---

## 2. Default Learning Mode vs. Gated Practice Mode
- **Learning Mode (Default)**:
  - Designed for coursework, graded tests, and competitive contests.
  - Generates:
    - Conceptual explanations and problem restatements.
    - Graduated hints (Level 1 intuition, Level 2 algorithmic strategies, Level 3 pseudocode & invariants).
    - Time and space complexity trade-offs ($O(N^2)$ vs. $O(N \log N)$).
    - Code reviews that flag edge cases, buffer bounds, and overflow without replacing the student's solution.
    - Targeted diagnostic help for compiler/runtime errors.
  - **Refusal**: Attempting to generate ready-to-submit answers in Learning Mode returns an explicit refusal explaining why complete answers are blocked.
- **Practice Mode**:
  - Intended solely for personal practice where AI assistance is explicitly authorized by applicable rules.
  - Gated behind an explicit confirmation checkbox: *"I confirm that AI-assisted code is permitted for this task."*
  - All generated code is prominently badged as **AI-Assisted** with inline algorithmic comments.

---

## 3. Credential & Data Security
- **No Credential Interception**: The app never prompts for, reads, transmits, or logs passwords, session cookies, or auth tokens.
- **Dedicated Profile Isolation**: Chromium runs with a dedicated local user data directory (`./.codechef_profile`). Your everyday browser profile and personal browsing data are never touched.
- **Localhost Binding**: The FastAPI backend binds exclusively to `127.0.0.1` and restricts CORS solely to `http://localhost:5173`.
- **Zero API Key Leakage**: AI provider keys are stored in backend `.env` variables and are never transmitted to the frontend.

---

## 4. Sandbox Isolation & Anti-Malware Safeguards
- **Docker Isolation**: All user-submitted C++17 code runs inside an unprivileged Alpine Docker container.
- **No Network**: Network access is completely disabled (`--network none`) to prevent exfiltration, reverse shells, or unwanted socket traffic.
- **Ceiling Constraints**: Container memory is capped at 256MB, CPU at 1.0 core, process count at 64 PIDs, and wall-clock execution at 5 seconds.
- **Strictly No Host Execution**: If Docker is unavailable, the application halts with a setup message. Unrestricted host execution fallback is forbidden.
