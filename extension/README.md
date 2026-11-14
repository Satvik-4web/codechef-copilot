# CodeChef Copilot — Chrome Extension

A native Manifest V3 Chrome Extension that brings CodeChef Copilot directly into your regular Chrome browser tab.

---

## Features

- **Side Panel Companion**: Opens in Chrome's native side panel right alongside your CodeChef problem.
- **Floating In-Page Launcher**: Floating AI pill on all `codechef.com` pages for one-click access.
- **1-Click DOM Extraction**: Instantly captures problem title, constraints, I/O specifications, and sample test cases directly from the page.
- **Graduated Hints & Explanations**: 3-tier hints and plain-language summaries without spoiling answers.
- **Complexity Analyzer**: Shows optimal time/space targets.
- **Docker-Isolated Sandbox Testing**: Runs test cases in your local container directly from the side panel.
- **Direct Code Injection**: Injects tested C++17 code directly into CodeChef's web editor with one click.
- **Strict Integrity Rules**: Enforces Learning Mode by default; unlocks reference solutions only in authorized Practice Mode.

---

## 10-Second Installation Guide

1. Open **Google Chrome**.
2. In the Chrome URL bar, navigate to:
   ```
   chrome://extensions
   ```
3. In the top-right corner, toggle **Developer mode** to **ON**.
4. In the top-left corner, click **Load unpacked**.
5. Select this folder:
   ```
   d:\metahackathon\codechef-copilot\extension
   ```
6. The **CodeChef Copilot** extension is now installed!

---

## How to Use

1. Ensure your local backend is running (`uvicorn app.main:app` on `http://127.0.0.1:8000`).
2. Open any CodeChef problem page in Chrome (e.g., `https://www.codechef.com/problems/FLOW001`).
3. Click the floating **CodeChef Copilot** badge at the bottom-right of the page (or click the extension icon in your Chrome toolbar).
4. The **Side Panel** opens! Click **Extract From Active Tab**.
5. Request explanations, hints, or complexity analysis as you work through the problem.

### Course Auto-Pilot

On a CodeChef Learn course page, turn on **Auto-Pilot** from the floating button. It identifies reading modules, quizzes and coding labs from their visible controls (the `/problems/` URL is shared by all three). Reading modules advance; quizzes select an AI answer, submit it, and advance only after positive site feedback. Coding labs submit generated code, inspect the site's test results and success banner, and attempt up to three repairs after failures. A missing editor, unavailable AI answer, uncertain result or repeated failure pauses that question instead of advancing.

The local backend must be running and its AI provider reachable to answer general quizzes and generate code. Click the floating **Copilot** pill to see whether the backend is online and whether it loaded an AI key; the key's validity is determined when an AI request runs. Explicit project classification/regression questions have a small offline fallback; other questions pause if the AI answer is unavailable. Some quizzes validate immediately when an option is clicked; a separate Submit button is optional. Coding labs wait while CodeChef starts the container and editor. They can verify code already in the editor without replacing it; if injection fails, they try the existing code once and stay on the question unless the site's tests pass. Reading modules are skipped only after their layout remains stable for five seconds. After updating these files, restart the backend, reload the unpacked extension at `chrome://extensions`, and refresh the CodeChef tab.
