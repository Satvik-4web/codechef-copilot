import os
import sys
import re
import time
import asyncio
from typing import Optional
from pathlib import Path
from playwright.async_api import async_playwright, BrowserContext, Page

# Unbuffered stdout for live real-time logging
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).parent.resolve()))

from app.config import settings
from app.database import get_db
from app.services.assistant.service import AssistantService

COURSE_FLOW_JS_PATH = Path(__file__).parent.parent / "extension" / "course-flow.js"
DEFAULT_COURSE_URL = "https://www.codechef.com/learn/course/tiet-uml501-ml-2026"

def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


async def get_active_page(context: BrowserContext) -> Optional[Page]:
    """Finds the most recent open CodeChef tab in the context."""
    for pg in reversed(context.pages):
        if not pg.is_closed() and "codechef.com" in pg.url:
            return pg
    for pg in reversed(context.pages):
        if not pg.is_closed():
            return pg
    return None


async def ensure_course_flow(page: Page):
    """Injects course-flow.js helper into the page if not already present."""
    try:
        has_flow = await page.evaluate("() => typeof window.CodeChefCourseFlow !== 'undefined'")
        if not has_flow and COURSE_FLOW_JS_PATH.exists():
            flow_code = COURSE_FLOW_JS_PATH.read_text(encoding="utf-8")
            await page.evaluate(flow_code)
    except Exception:
        pass


async def dismiss_modals(page: Page):
    """Dismisses any SweetAlert2 or overlay modal backdrops blocking clicks."""
    try:
        await page.keyboard.press("Escape")
        await page.evaluate("""() => {
            const swalBtn = document.querySelector(".swal2-confirm, .swal2-close, button[class*='swal2']");
            if (swalBtn) swalBtn.click();
            const backdrop = document.querySelector(".swal2-container");
            if (backdrop) backdrop.remove();
        }""")
    except Exception:
        pass


def bring_chrome_to_foreground():
    try:
        import ctypes
        from ctypes import wintypes
        user32 = ctypes.windll.user32

        def enum_cb(hwnd, _):
            if user32.IsWindowVisible(hwnd):
                length = user32.GetWindowTextLengthW(hwnd)
                if length > 0:
                    buff = ctypes.create_unicode_buffer(length + 1)
                    user32.GetWindowTextW(hwnd, buff, length + 1)
                    title = buff.value
                    if "Chrome" in title or "CodeChef" in title:
                        user32.ShowWindow(hwnd, 9)  # SW_RESTORE
                        user32.SetForegroundWindow(hwnd)
            return True

        WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
        user32.EnumWindows(WNDENUMPROC(enum_cb), 0)
    except Exception:
        pass


async def check_and_handle_login(page: Page) -> bool:
    """Detects if CodeChef is showing a login modal/page or 403 unauthorised, and prompts/waits for login."""
    state = await page.evaluate("""() => {
        const b = document.body ? document.body.innerText : '';
        const isLoggedOutMsg = /Continue with Google/i.test(b) || /login to codechef/i.test(b) || /you have been logged out/i.test(b) || (location.pathname === '/login');
        const is403 = /not authorised to access this content/i.test(b) || (b.includes('403') && /authorised/i.test(b));
        const hasLoginBtn = Array.from(document.querySelectorAll('a, button')).some(el => (el.innerText || '').trim().toLowerCase() === 'login');
        const hasProfile = /Hello,/i.test(b) || document.querySelector("[class*='profile'], [class*='avatar'], [href*='/users/']") !== null;
        return { isLoggedOutMsg, is403, hasLoginBtn, hasProfile };
    }""")

    needs_login = state.get("isLoggedOutMsg") or state.get("is403") or (state.get("hasLoginBtn") and not state.get("hasProfile"))

    if needs_login:
        bring_chrome_to_foreground()
        log("⚠️  CODECHEF SESSION LOGGED OUT / UNAUTHORIZED!")
        log("👉  Please log in to CodeChef in the opened Chrome window (Click 'Login' -> 'Continue with Google').")
        log("👉  The runner will automatically detect your login and start solving immediately!")

        # If on 403, navigate to login page directly
        if state.get("is403") and "login" not in page.url:
            try:
                await page.goto("https://www.codechef.com/login", timeout=15000)
            except Exception:
                pass

        for _ in range(150):
            await asyncio.sleep(2.0)
            logged_in = await page.evaluate("""() => {
                const b = document.body ? document.body.innerText : '';
                const is403 = /not authorised to access this content/i.test(b);
                const isLogin = /Continue with Google/i.test(b) || /login to codechef/i.test(b) || (location.pathname === '/login');
                const hasProfile = /Hello,/i.test(b) || document.querySelector("[class*='profile'], [class*='avatar'], [href*='/users/']") !== null;
                return !is403 && !isLogin && hasProfile;
            }""")
            if logged_in:
                log("🎉 Login detected! Resuming autonomous speedrun in 2 seconds...")
                await asyncio.sleep(2.0)
                if "tiet-uml501-ml-2026" not in page.url:
                    await page.goto(DEFAULT_COURSE_URL, timeout=30000)
                    await asyncio.sleep(2.0)
                return True
        return False
    return True


async def click_next_button(page: Page) -> bool:
    """Clicks Move to next problem or header Next button using real Playwright clicks."""
    await dismiss_modals(page)

    # Priority 1: "Move to next problem" button
    for text_pat in [re.compile(r"^move to next problem$", re.I), re.compile(r"^move to next$", re.I)]:
        loc = page.locator("button, a, [role='button'], div[class*='btn']").filter(has_text=text_pat).first
        if await loc.count() > 0:
            log("Clicking 'Move to next problem'...")
            try:
                await loc.click(force=True, timeout=2500)
                return True
            except Exception:
                pass

    # Priority 2: Header "Next" button
    for text_pat in [re.compile(r"^next$", re.I), re.compile(r"^next module$", re.I), re.compile(r"^next >$", re.I)]:
        loc = page.locator("button, a, [role='button']").filter(has_text=text_pat).first
        if await loc.count() > 0:
            log("Clicking header 'Next' button...")
            try:
                await loc.click(force=True, timeout=2500)
                return True
            except Exception:
                pass

    # Priority 3: DOM fallback click (immune to pointer event interceptions)
    clicked = await page.evaluate("""() => {
        const isNext = (s) => /^(move to next problem|move to next|next|next module|next question)$/i.test((s || "").trim());
        const btns = Array.from(document.querySelectorAll("button, a, [role='button'], div[class*='btn']")).filter(b => isNext(b.innerText));
        if (btns.length > 0) {
            const target = btns[0];
            target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            if (typeof target.click === 'function') target.click();
            return true;
        }
        return false;
    }""")
    return clicked


async def handle_course_overview(page: Page) -> bool:
    """Handles course syllabus/overview page by clicking Resume / Start button."""
    resume_patterns = [
        re.compile(r"^resume$", re.I),
        re.compile(r"^start learning$", re.I),
        re.compile(r"^continue$", re.I),
        re.compile(r"^start$", re.I),
    ]

    for pat in resume_patterns:
        loc = page.locator("button, a, [role='button']").filter(has_text=pat).first
        if await loc.count() > 0 and await loc.is_visible():
            log(f"Course Overview: Found '{await loc.inner_text()}' button! Clicking to enter problems...")
            await loc.click()
            await asyncio.sleep(3.0)
            return True

    # Try clicking Resume via DOM query
    clicked = await page.evaluate("""() => {
        const resumeBtn = Array.from(document.querySelectorAll("button, a, [role='button'], div")).find(el => {
            const t = (el.innerText || "").trim().toLowerCase();
            return t === "resume" || t === "start learning" || t === "continue";
        });
        if (resumeBtn) {
            resumeBtn.click();
            return true;
        }
        const item = document.querySelector("a[href*='/problems/'], [class*='problem-card'] a, [class*='module'] a");
        if (item) { item.click(); return true; }
        return false;
    }""")
    if clicked:
        log("Course Overview: Clicked Resume or problem link...")
        await asyncio.sleep(3.0)
        return True

    return False


async def solve_theory(page: Page):
    log("[Theory] Skipping reading module...")
    # Click "Mark as read" or "Continue" if present
    for pat in [re.compile(r"^(mark as read|mark as complete|continue|got it)$", re.I)]:
        loc = page.locator("button, a").filter(has_text=pat).first
        if await loc.count() > 0 and await loc.is_visible():
            log(f"[Theory] Clicked '{await loc.inner_text()}'...")
            await loc.click()
            await asyncio.sleep(0.5)
            break

    await click_next_button(page)
    await asyncio.sleep(2.0)


async def solve_mcq(page: Page):
    log("[MCQ] Extracting question and choices...")
    data = await page.evaluate("""() => {
        const titleEl = document.querySelector("h1, h2, h3, [class*='title'], [class*='Title']");
        const title = titleEl ? titleEl.innerText.trim() : "";
        const stmtEl = document.querySelector("[class*='statement'], [class*='Statement'], main, #problem-statement");
        const statement = stmtEl ? stmtEl.innerText.trim() : document.body.innerText.slice(0, 3000);

        let choices = [];
        if (window.CodeChefCourseFlow) {
            choices = window.CodeChefCourseFlow.options(document).map(c => c.text);
        }
        if (!choices || choices.length === 0) {
            choices = Array.from(document.querySelectorAll("label, div[role='radio'], [class*='option'], [class*='choice']"))
                .map(el => el.innerText.trim())
                .filter(t => t.length > 0 && t.length < 300);
        }
        return { title, statement, choices };
    }""")

    choices = data.get("choices", [])
    question = data.get("statement") or data.get("title") or "MCQ Question"
    log(f"[MCQ] Question: {question[:80]}...")
    log(f"[MCQ] Options ({len(choices)}): {choices}")

    if not choices:
        log("[MCQ] No choices found! Advancing...")
        await click_next_button(page)
        return

    # Solve via AI
    ai_res = await AssistantService.solve_mcq(
        question=question,
        options=choices,
        context=question
    )
    correct_idx = ai_res.get("correct_option_index", 0)
    choice_text = choices[correct_idx] if correct_idx < len(choices) else ""
    log(f"[MCQ] AI selected option {correct_idx + 1}: '{choice_text}'")

    # Click option
    await page.evaluate("""(idx) => {
        if (window.CodeChefCourseFlow) {
            const opts = window.CodeChefCourseFlow.options(document);
            if (opts[idx]) {
                const choice = opts[idx];
                if (choice.input) {
                    choice.input.checked = true;
                    choice.input.dispatchEvent(new Event('input', { bubbles: true }));
                    choice.input.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (choice.target) choice.target.click();
                return;
            }
        }
        const cards = document.querySelectorAll("label, div[role='radio'], [class*='option'], [class*='choice']");
        if (cards[idx]) cards[idx].click();
    }""", correct_idx)
    await asyncio.sleep(0.5)

    # Click Submit if present
    submit_loc = page.locator("button, [role='button']").filter(has_text=re.compile(r"^(submit|submit answer|check)$", re.I)).first
    if await submit_loc.count() > 0:
        log("[MCQ] Clicking Submit button...")
        try:
            await submit_loc.click(force=True, timeout=2500)
        except Exception:
            await page.evaluate("""() => {
                const btn = Array.from(document.querySelectorAll("button, [role='button']")).find(b =>
                    /^(submit|submit answer|check)$/i.test((b.innerText || "").trim())
                );
                if (btn) btn.click();
            }""")
        await asyncio.sleep(1.0)

    # Check feedback status
    status = await page.evaluate("() => window.CodeChefCourseFlow ? window.CodeChefCourseFlow.mcqResult(document) : 'pending'")
    log(f"[MCQ] Feedback status: {status}")

    await click_next_button(page)
    await asyncio.sleep(2.0)


async def solve_coding(page: Page):
    # Check if worked example (Run button present, no Submit button)
    is_worked_example = await page.evaluate("""() => {
        const buttons = Array.from(document.querySelectorAll("button, [role='button'], a"));
        const hasSubmit = buttons.some(b => /^(submit|submit code)$/i.test((b.innerText || "").trim()));
        const hasRun = buttons.some(b => /^(run|run code|▶ run)$/i.test((b.innerText || "").trim()));
        return !hasSubmit && hasRun;
    }""")

    if is_worked_example:
        log("[Worked Example] Tutorial lab detected (no Submit button). Clicking ▶ Run...")
        run_loc = page.locator("button, [role='button']").filter(has_text=re.compile(r"^(run|run code|▶ run)$", re.I)).first
        if await run_loc.count() > 0:
            await run_loc.click()
        log("[Worked Example] Waiting 3.5s for terminal execution...")
        await asyncio.sleep(3.5)
        log("[Worked Example] Advancing to next module...")
        await click_next_button(page)
        await asyncio.sleep(2.0)
        return

    # Graded coding lab
    log("[Coding] Graded problem detected! Extracting requirements and editor state...")
    problem_data = await page.evaluate("""() => {
        const titleEl = document.querySelector("#problem-statement h1, h1.title, .problem-title h3, h2.title, h1");
        const title = titleEl ? titleEl.innerText.trim() : "Task";
        const stmtEl = document.querySelector("#problem-statement, .problem-statement, #problem-body, [class*='statement']");
        const statement = stmtEl ? stmtEl.innerText.trim() : document.body.innerText.slice(0, 6000);

        let editorCode = "";
        if (window.monaco && window.monaco.editor) {
            const editors = window.monaco.editor.getEditors ? window.monaco.editor.getEditors() : [];
            if (editors.length > 0 && editors[0].getModel()) {
                editorCode = editors[0].getModel().getValue();
            } else {
                const models = window.monaco.editor.getModels();
                const pyModel = models.find(m => m.uri && m.uri.path && m.uri.path.endsWith('.py')) || models[0];
                if (pyModel) editorCode = pyModel.getValue();
            }
        }
        if (!editorCode) {
            const viewLines = document.querySelectorAll(".view-lines .view-line");
            if (viewLines.length > 0) editorCode = Array.from(viewLines).map(l => l.innerText).join("\\n");
        }

        return { title, statement, editorCode };
    }""")

    title = problem_data.get("title", "Coding Problem")
    statement = problem_data.get("statement", "")
    editor_code = problem_data.get("editorCode", "")

    # Wait for editor code if Monaco is still initializing
    if not editor_code or len(editor_code.strip()) == 0:
        for _ in range(8):
            await asyncio.sleep(0.5)
            editor_code = await page.evaluate("""() => {
                let code = "";
                if (window.monaco && window.monaco.editor) {
                    const editors = window.monaco.editor.getEditors ? window.monaco.editor.getEditors() : [];
                    if (editors.length > 0 && editors[0].getModel()) {
                        code = editors[0].getModel().getValue();
                    } else {
                        const models = window.monaco.editor.getModels();
                        const pyModel = models.find(m => m.uri && m.uri.path && m.uri.path.endsWith('.py')) || models[0];
                        if (pyModel) code = pyModel.getValue();
                    }
                }
                if (!code) {
                    const viewLines = document.querySelectorAll(".view-lines .view-line");
                    if (viewLines.length > 0) code = Array.from(viewLines).map(l => l.innerText).join("\\n");
                }
                return code;
            }""")
            if editor_code and len(editor_code.strip()) > 0:
                break

    log(f"[Coding] Problem: '{title}'")
    if editor_code:
        log(f"[Coding] Starter template loaded ({len(editor_code.splitlines())} lines).")
    log("[Coding] Requesting solution from Gemini AI...")

    db = next(get_db())
    sol_res = await AssistantService.practice_solution(
        db=db,
        problem_id=None,
        user_confirmed_allowed=True,
        language="python",
        problem_statement=statement,
        editor_code=editor_code,
        title=title
    )
    solution_code = sol_res.get("generated_code")
    if not solution_code:
        log("[Coding] Warning: No solution code returned!")
        return

    current_code = solution_code

    # Submit and heal loop
    for attempt in range(4):
        log(f"[Coding] Injecting solution into Monaco editor (attempt {attempt + 1}/4)...")
        await page.evaluate("""(code) => {
            if (window.monaco && window.monaco.editor) {
                let targetModel = null;
                const editors = window.monaco.editor.getEditors ? window.monaco.editor.getEditors() : [];
                if (editors.length > 0 && editors[0].getModel()) {
                    targetModel = editors[0].getModel();
                    try { editors[0].focus(); } catch (_) {}
                }
                if (!targetModel) {
                    const models = window.monaco.editor.getModels();
                    targetModel = models.find(m => m.uri && m.uri.path && m.uri.path.endsWith('.py')) || models[0];
                }
                if (targetModel) {
                    targetModel.setValue(code);
                }
            }
        }""", current_code)

        # Focus editor and trigger Save (Ctrl+S) so Monaco flushes file to container disk
        log("[Coding] Saving file to container disk (Ctrl+S)...")
        try:
            editor_loc = page.locator(".monaco-editor, .view-lines").first
            if await editor_loc.count() > 0:
                await editor_loc.click(timeout=1000)
        except Exception:
            pass
        await page.keyboard.press("Control+s")
        await asyncio.sleep(0.5)

        # Click Submit
        log("[Coding] Clicking Submit button...")
        await dismiss_modals(page)
        submit_loc = page.locator("button, [role='button']").filter(has_text=re.compile(r"^(submit|submit code)$", re.I)).first
        if await submit_loc.count() > 0:
            try:
                await submit_loc.click(force=True, timeout=2500)
            except Exception:
                await page.evaluate("""() => {
                    const btn = Array.from(document.querySelectorAll("button, [role='button']")).find(b =>
                        /^(submit|submit code)$/i.test((b.innerText || "").trim())
                    );
                    if (btn) btn.click();
                }""")
        else:
            await page.evaluate("""() => {
                const btn = Array.from(document.querySelectorAll("button, [role='button']")).find(b =>
                    /^(submit|submit code)$/i.test((b.innerText || "").trim())
                );
                if (btn) btn.click();
            }""")

        # Poll test results
        log("[Coding] Waiting for test results...")
        passed = False
        for poll in range(40):
            await asyncio.sleep(1.0)
            await dismiss_modals(page)

            # Direct check for completion buttons or congratulatory text
            move_btn = page.locator("button, a, [role='button']").filter(has_text=re.compile(r"^move to next problem$", re.I)).first
            has_move = (await move_btn.count() > 0) and (await move_btn.is_visible())
            is_solved_text = await page.evaluate("""() => {
                const b = document.body ? document.body.innerText : '';
                return /you have solved the problem/i.test(b) || /congratulations/i.test(b);
            }""")
            if has_move or is_solved_text:
                log("[Coding] PROBLEM SOLVED! Detected 'Move to next problem' / 'Congratulations'!")
                passed = True
                break

            await ensure_course_flow(page)
            res = await page.evaluate("() => window.CodeChefCourseFlow ? window.CodeChefCourseFlow.codeResult(document) : { status: 'pending', passed: 0, total: 0, failed: 0 }")
            status = res.get("status")
            total = res.get("total", 0)
            passed_cnt = res.get("passed", 0)
            failed_cnt = res.get("failed", 0)

            if total > 0:
                log(f"[Coding] Tests: {passed_cnt}/{total} passed, {failed_cnt} failed (status: {status})")

            if status == "passed":
                log("[Coding] ALL TESTS PASSED (green ticks confirmed)!")
                passed = True
                break

            if status == "failed" and poll >= 2:
                log(f"[Coding] Test failure detected early ({failed_cnt} failed)! Proceeding to self-heal...")
                break

        if passed:
            log("[Coding] Problem solved! Advancing to next...")
            await asyncio.sleep(0.5)
            await click_next_button(page)
            await asyncio.sleep(2.5)
            return

        if attempt < 3:
            log(f"[Coding] Self-healing tests (attempt {attempt + 1}/3)...")
            error_output = await page.evaluate("""() => {
                const res = window.CodeChefCourseFlow ? window.CodeChefCourseFlow.codeResult(document) : {};
                const testsEl = document.querySelector("[class*='tests'], [class*='test-results'], [data-testid='test-results'], #tab-tests");
                const testsText = testsEl ? testsEl.innerText : "";
                return (testsText + "\\n" + (res.output || "") + "\\n" + document.body.innerText.slice(0, 2000)).slice(0, 3000);
            }""")
            healed = await AssistantService.auto_heal(
                current_code=current_code,
                error_output=error_output,
                problem_statement=statement,
                language="python",
                title=title
            )
            fixed = healed.get("fixed_code")
            if fixed:
                current_code = fixed

    log("[Coding] Retries exhausted. Advancing...")
    prev_url = page.url
    await click_next_button(page)
    await asyncio.sleep(3.0)

    # If Next button in header was disabled or did not advance URL, attempt direct topic link navigation
    if page.url == prev_url:
        log("[Coding] URL unchanged after Next click. Clicking next problem from syllabus sidebar...")
        await page.evaluate("""() => {
            const links = Array.from(document.querySelectorAll("a[href*='/problems/']"));
            const curIdx = links.findIndex(a => a.href === location.href || location.href.includes(a.getAttribute('href')));
            if (curIdx >= 0 && links[curIdx + 1]) {
                links[curIdx + 1].click();
            } else if (links.length > 0) {
                // Click next visible sibling
                const nextBtn = document.querySelector("button:has-text('Next'), [aria-label*='Next'], [class*='next']");
                if (nextBtn) nextBtn.click();
            }
        }""")
        await asyncio.sleep(2.5)


active_chrome_proc = None


async def main():
    global active_chrome_proc
    log("=" * 65)
    log("   CODECHEF FULLY AUTONOMOUS BROWSER RUNNER (PLAYWRIGHT)       ")
    log("=" * 65)

    async with async_playwright() as p:
        context = None

        # Option 1: Connect to existing Chrome session on port 9222 if already running
        try:
            cdp_browser = await p.chromium.connect_over_cdp("http://127.0.0.1:9222", timeout=2000)
            context = cdp_browser.contexts[0] if cdp_browser.contexts else cdp_browser
            log("Connected to existing Chrome browser on port 9222!")
            bring_chrome_to_foreground()
        except Exception:
            pass

        # Option 2: Launch visible Chrome window on user's interactive desktop (WinSta0\Default) with CDP
        if not context:
            profile_dir = Path(__file__).parent / ".codechef_profile"
            profile_dir.mkdir(parents=True, exist_ok=True)
            log(f"Launching visible Chrome on interactive desktop (profile: {profile_dir})...")

            try:
                import subprocess
                si = subprocess.STARTUPINFO()
                si.lpDesktop = r"WinSta0\Default"
                chrome_exe = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
                if not Path(chrome_exe).exists():
                    chrome_exe = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

                active_chrome_proc = subprocess.Popen([
                    chrome_exe,
                    "--remote-debugging-port=9222",
                    "--remote-allow-origins=*",
                    f"--user-data-dir={profile_dir}",
                    "--no-first-run",
                    "--no-default-browser-check",
                    DEFAULT_COURSE_URL
                ], startupinfo=si)

                for attempt in range(12):
                    await asyncio.sleep(1.0)
                    try:
                        cdp_browser = await p.chromium.connect_over_cdp("http://127.0.0.1:9222", timeout=2000)
                        context = cdp_browser.contexts[0] if cdp_browser.contexts else cdp_browser
                        log("Successfully connected to visible Chrome on user desktop over CDP!")
                        bring_chrome_to_foreground()
                        break
                    except Exception:
                        pass
            except Exception as e:
                log(f"Notice launching interactive desktop Chrome: {e}")

        # Option 3: Fallback persistent context
        if not context:
            profile_dir = Path(__file__).parent / ".codechef_profile"
            profile_dir.mkdir(parents=True, exist_ok=True)
            log(f"Launching persistent Chrome window (profile: {profile_dir})...")

            try:
                context = await p.chromium.launch_persistent_context(
                    user_data_dir=str(profile_dir),
                    channel="chrome",
                    headless=False,
                    viewport={"width": 1366, "height": 850},
                    args=[
                        "--disable-blink-features=AutomationControlled",
                        "--no-first-run",
                        "--no-default-browser-check"
                    ]
                )
            except Exception:
                context = await p.chromium.launch_persistent_context(
                    user_data_dir=str(profile_dir),
                    headless=False,
                    viewport={"width": 1366, "height": 850},
                    args=[
                        "--disable-blink-features=AutomationControlled",
                        "--no-first-run",
                        "--no-default-browser-check"
                    ]
                )

        # Get or create initial page and navigate directly to the course
        page = await get_active_page(context)
        if not page:
            page = await context.new_page()

        if "codechef.com" not in page.url:
            log(f"Navigating to course: {DEFAULT_COURSE_URL}...")
            await page.goto(DEFAULT_COURSE_URL, timeout=45000)

        log("Ready! Starting autonomous continuous loop in 2 seconds...\n")
        await asyncio.sleep(2.0)

        step = 1
        while True:
            try:
                # Dynamically get active page
                page = await get_active_page(context)
                if not page or page.is_closed():
                    log("No open pages. Waiting 3s...")
                    await asyncio.sleep(3.0)
                    continue

                url = page.url

                # Check login status
                logged_in = await check_and_handle_login(page)
                if not logged_in:
                    await asyncio.sleep(2.0)
                    continue

                # If on course overview / syllabus without /problems/, click Resume!
                if "codechef.com/learn/course/" in url and "/problems/" not in url:
                    entered = await handle_course_overview(page)
                    if entered:
                        await asyncio.sleep(3.0)
                        continue

                if "codechef.com/learn/course/tiet-uml501-ml-2026" not in url and not url.startswith("https://www.codechef.com/login") and "accounts.google.com" not in url:
                    log(f"Navigating back to course URL from: {url}...")
                    await page.goto(DEFAULT_COURSE_URL, timeout=30000)
                    await asyncio.sleep(3.0)
                    continue

                await ensure_course_flow(page)
                screen = await page.evaluate("""() => {
                    if (window.CodeChefCourseFlow) {
                        return window.CodeChefCourseFlow.classify(document, location.href);
                    }
                    return { type: 'unknown', isPassed: false };
                }""")

                stype = screen.get("type", "unknown")
                is_passed = screen.get("isPassed", False)
                log(f"\n--- [Step {step}] URL: {url} ---")
                log(f"Screen Type: {stype.upper()} (Already passed: {is_passed})")

                if is_passed:
                    log("Screen already passed! Advancing to next...")
                    await click_next_button(page)
                    await asyncio.sleep(2.0)
                elif stype == "theory":
                    await solve_theory(page)
                elif stype == "mcq":
                    await solve_mcq(page)
                elif stype == "coding":
                    await solve_coding(page)
                elif stype == "loading":
                    log("Editor or container is loading, waiting...")
                    await asyncio.sleep(2.5)
                else:
                    log("Unknown screen, attempting Next...")
                    await click_next_button(page)
                    await asyncio.sleep(2.0)

                step += 1
                await asyncio.sleep(1.0)

            except Exception as e:
                log(f"Loop notice: {e}")
                await asyncio.sleep(3.0)


if __name__ == "__main__":
    asyncio.run(main())
