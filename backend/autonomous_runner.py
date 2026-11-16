import os
import sys
import time
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright, BrowserContext, Page

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).parent.resolve()))

from app.config import settings
from app.services.assistant.service import AssistantService

COURSE_FLOW_JS_PATH = Path(__file__).parent.parent / "extension" / "course-flow.js"

async def get_or_create_page(p) -> tuple[BrowserContext, Page, bool]:
    """
    Connects to an existing Chrome instance on CDP (port 9222) if available.
    Otherwise, launches a dedicated visible Chrome browser with a persistent profile.
    """
    import urllib.request
    has_cdp = False
    try:
        urllib.request.urlopen("http://localhost:9222/json/version", timeout=1)
        has_cdp = True
    except Exception:
        has_cdp = False

    if has_cdp:
        print("[Runner] Found existing Chrome on port 9222! Connecting via CDP...")
        browser = await p.chromium.connect_over_cdp("http://localhost:9222")
        context = browser.contexts[0]
        # Look for existing CodeChef page
        for pg in context.pages:
            if "codechef.com" in pg.url:
                print(f"[Runner] Attached to open CodeChef tab: {pg.url}")
                return context, pg, True
        # If no CodeChef tab, use the first page or open a new one
        page = context.pages[0] if context.pages else await context.new_page()
        return context, page, True

    # Launch dedicated persistent Chrome browser
    profile_dir = Path(__file__).parent / ".codechef_profile"
    profile_dir.mkdir(parents=True, exist_ok=True)
    print(f"[Runner] Launching persistent Chrome browser window (profile: {profile_dir})...")

    # Try launching real Chrome first, fallback to bundled chromium
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

    page = context.pages[0] if context.pages else await context.new_page()
    if page.url == "about:blank":
        print("[Runner] Opening CodeChef...")
        await page.goto("https://www.codechef.com", timeout=30000)

    return context, page, False


async def ensure_course_flow(page: Page):
    """Injects course-flow.js helper into the page."""
    if COURSE_FLOW_JS_PATH.exists():
        flow_code = COURSE_FLOW_JS_PATH.read_text(encoding="utf-8")
        await page.evaluate(flow_code)


async def click_next_button(page: Page) -> bool:
    """Clicks Move to next problem, Resume, or header Next button."""
    clicked = await page.evaluate("""() => {
        const isNextText = (raw) => {
            if (!raw) return false;
            const clean = raw.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\\s+/g, " ").trim();
            return clean === "move to next problem" || clean === "move to next" ||
                   clean === "resume" || clean === "start learning" || clean === "continue" ||
                   clean === "start" || clean === "next" || clean === "next module" || clean === "next question";
        };

        const buttons = Array.from(document.querySelectorAll("button, [role='button'], a, div[class*='btn']"));
        // Priority 0: Resume / Continue button on course syllabus / overview
        const resumeBtn = buttons.find(b => {
            const t = (b.innerText || "").toLowerCase().trim();
            return t === "resume" || t === "start learning" || t === "continue" || t === "start";
        });
        if (resumeBtn) {
            resumeBtn.click();
            return true;
        }

        // Priority 1: Move to next problem
        const moveBtn = buttons.find(b => {
            const t = (b.innerText || "").toLowerCase().trim();
            return t === "move to next problem" || t === "move to next";
        });
        if (moveBtn) {
            moveBtn.click();
            return true;
        }

        // Priority 2: Header Next button
        const nextBtn = buttons.find(b => isNextText(b.innerText));
        if (nextBtn) {
            nextBtn.click();
            return true;
        }
        return false;
    }""")
    return clicked


async def solve_theory(page: Page):
    print("[Theory] Skipping reading module...")
    await page.evaluate("""() => {
        const btn = Array.from(document.querySelectorAll("button, a")).find(b =>
            /^(mark as read|mark as complete|continue|got it)$/i.test((b.innerText || "").trim())
        );
        if (btn) btn.click();
    }""")
    await asyncio.sleep(0.5)
    await click_next_button(page)
    await asyncio.sleep(2.0)


async def solve_mcq(page: Page):
    print("[MCQ] Extracting question and options...")
    data = await page.evaluate("""() => {
        const titleEl = document.querySelector("h1, h2, h3, [class*='title'], [class*='Title']");
        const title = titleEl ? titleEl.innerText.trim() : "";
        const stmtEl = document.querySelector("[class*='statement'], [class*='Statement'], main, #problem-statement");
        const statement = stmtEl ? stmtEl.innerText.trim() : document.body.innerText.slice(0, 3000);

        const choices = window.CodeChefCourseFlow ? window.CodeChefCourseFlow.options(document).map(c => c.text) : [];
        return { title, statement, choices };
    }""")

    choices = data.get("choices", [])
    if not choices:
        # Fallback query
        choices = await page.evaluate("""() => {
            return Array.from(document.querySelectorAll("label, div[role='radio'], [class*='option'], [class*='choice']"))
                .map(el => el.innerText.trim())
                .filter(t => t.length > 0 && t.length < 300);
        }""")

    print(f"[MCQ] Question: {data.get('title') or data.get('statement')[:100]}...")
    print(f"[MCQ] Found {len(choices)} options.")

    if not choices:
        print("[MCQ] No choices found! Advancing...")
        await click_next_button(page)
        return

    # Solve via AI
    ai_res = await AssistantService.solve_mcq(
        question=data.get("statement") or data.get("title"),
        options=choices,
        context=data.get("statement")
    )
    correct_idx = ai_res.get("correct_option_index", 0)
    print(f"[MCQ] AI selected option {correct_idx}: {choices[correct_idx] if correct_idx < len(choices) else ''}")

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
    await page.evaluate("""() => {
        const submitBtn = Array.from(document.querySelectorAll("button, [role='button']")).find(b =>
            /^(submit|submit answer|check)$/i.test((b.innerText || "").trim())
        );
        if (submitBtn) submitBtn.click();
    }""")

    await asyncio.sleep(1.2)
    # Check feedback
    status = await page.evaluate("() => window.CodeChefCourseFlow ? window.CodeChefCourseFlow.mcqResult(document) : 'pending'")
    print(f"[MCQ] Result status: {status}")

    await click_next_button(page)
    await asyncio.sleep(2.0)


async def solve_coding(page: Page):
    # Check if worked example
    is_worked_example = await page.evaluate("""() => {
        const buttons = Array.from(document.querySelectorAll("button, [role='button'], a"));
        const hasSubmit = buttons.some(b => /^(submit|submit code)$/i.test((b.innerText || "").trim()));
        const hasRun = buttons.some(b => /^(run|run code|▶ run)$/i.test((b.innerText || "").trim()));
        return !hasSubmit && hasRun;
    }""")

    if is_worked_example:
        print("[Worked Example] Detected tutorial lab (no Submit button). Clicking ▶ Run...")
        await page.evaluate("""() => {
            const runBtn = Array.from(document.querySelectorAll("button, [role='button']")).find(b =>
                /^(run|run code|▶ run)$/i.test((b.innerText || "").trim())
            );
            if (runBtn) runBtn.click();
        }""")
        print("[Worked Example] Waiting 3.5s for terminal execution...")
        await asyncio.sleep(3.5)
        print("[Worked Example] Finished. Advancing to next module...")
        await click_next_button(page)
        await asyncio.sleep(2.0)
        return

    # Graded coding lab
    print("[Coding] Extracting problem data and editor content...")
    problem_data = await page.evaluate("""() => {
        const titleEl = document.querySelector("#problem-statement h1, h1.title, .problem-title h3, h2.title, h1");
        const title = titleEl ? titleEl.innerText.trim() : "Task";
        const stmtEl = document.querySelector("#problem-statement, .problem-statement, #problem-body, [class*='statement']");
        const statement = stmtEl ? stmtEl.innerText.trim() : document.body.innerText.slice(0, 6000);

        let editorCode = "";
        if (window.monaco && window.monaco.editor) {
            const models = window.monaco.editor.getModels();
            if (models.length > 0) editorCode = models[0].getValue();
        }
        if (!editorCode) {
            const viewLines = document.querySelectorAll(".view-lines .view-line");
            if (viewLines.length > 0) editorCode = Array.from(viewLines).map(l => l.innerText).join("\\n");
        }

        return { title, statement, editorCode };
    }""")

    title = problem_data.get("title")
    statement = problem_data.get("statement")
    editor_code = problem_data.get("editorCode")

    print(f"[Coding] Problem: {title}")
    print("[Coding] Requesting solution from Gemini AI...")

    from app.database import get_db
    from app.services.assistant.service import AssistantService

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
        print("[Coding] No solution code returned!")
        return

    # Invert/inject into Monaco and save
    current_code = solution_code
    for attempt in range(4):
        print(f"[Coding] Injecting solution (attempt {attempt + 1}/4)...")
        await page.evaluate("""(code) => {
            if (window.monaco && window.monaco.editor) {
                const models = window.monaco.editor.getModels();
                if (models.length > 0) {
                    models[0].setValue(code);
                }
            }
        }""", current_code)

        # Trigger Save (Ctrl+S)
        await page.keyboard.press("Control+s")
        await asyncio.sleep(0.5)

        # Click Submit
        print("[Coding] Clicking Submit button...")
        await page.evaluate("""() => {
            const submitBtn = Array.from(document.querySelectorAll("button, [role='button']")).find(b =>
                /^(submit|submit code)$/i.test((b.innerText || "").trim())
            );
            if (submitBtn) submitBtn.click();
        }""")

        # Poll test results
        print("[Coding] Waiting for tests to evaluate...")
        passed = False
        for poll in range(40):
            await asyncio.sleep(1.0)
            res = await page.evaluate("() => window.CodeChefCourseFlow ? window.CodeChefCourseFlow.codeResult(document) : { status: 'pending', passed: 0, total: 0 }")
            status = res.get("status")
            total = res.get("total", 0)
            passed_cnt = res.get("passed", 0)

            if total > 0:
                print(f"[Coding] Tests: {passed_cnt}/{total} ticked (status: {status})")

            if status == "passed":
                print("[Coding] ALL TESTS PASSED (green ticks confirmed)!")
                passed = True
                break

            if status == "failed" and poll > 3:
                print("[Coding] Test failures detected!")
                break

        if passed:
            print("[Coding] Advancing to next problem...")
            await asyncio.sleep(0.5)
            await click_next_button(page)
            await asyncio.sleep(2.5)
            return

        if attempt < 3:
            print(f"[Coding] Triggering Auto-Heal (attempt {attempt + 1}/3)...")
            error_output = await page.evaluate("""() => {
                const res = window.CodeChefCourseFlow ? window.CodeChefCourseFlow.codeResult(document) : {};
                return res.output || document.body.innerText.slice(0, 2000);
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

    print("[Coding] Healing attempts exhausted. Moving forward...")
    await click_next_button(page)
    await asyncio.sleep(2.0)


async def main():
    print("=" * 65)
    print("   CODECHEF FULLY AUTONOMOUS SPEEDRUNNER (PLAYWRIGHT DIRECT)    ")
    print("=" * 65)

    async with async_playwright() as p:
        context, page, is_attached = await get_or_create_page(p)

        print("\n[Runner] Ready! Make sure you are logged in and on the course page:")
        print("          https://www.codechef.com/learn/course/...")
        print("[Runner] Starting autonomous processing loop in 3 seconds...\n")
        await asyncio.sleep(3.0)

        step = 1
        while True:
            try:
                # Ensure page is open
                if page.is_closed():
                    print("[Runner] Browser page was closed. Exiting.")
                    break

                url = page.url
                if "codechef.com/learn/course/" not in url and "codechef.com" in url:
                    print(f"[Runner] Waiting for course URL (current: {url})...")
                    await asyncio.sleep(3.0)
                    continue

                # Check for Course Overview / Syllabus page without /problems/
                if "/problems/" not in url:
                    clicked_resume = await page.evaluate("""() => {
                        const btns = Array.from(document.querySelectorAll("button, [role='button'], a, div[class*='btn']"));
                        const resume = btns.find(b => /^(resume|start learning|continue|start)$/i.test((b.innerText || "").trim()));
                        if (resume) {
                            resume.click();
                            return true;
                        }
                        const firstItem = document.querySelector("[class*='item'], [class*='lesson'], [class*='chapter'], [class*='topic']");
                        if (firstItem) {
                            firstItem.click();
                            return true;
                        }
                        return false;
                    }""")
                    if clicked_resume:
                        print("[Runner] Course Overview detected. Clicked 'Resume' button to enter questions...")
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
                print(f"\n--- [Step {step}] URL: {url} ---")
                print(f"[Runner] Detected screen type: {stype.upper()} (Already passed: {is_passed})")

                if is_passed:
                    print("[Runner] Screen already passed! Advancing to next...")
                    await click_next_button(page)
                    await asyncio.sleep(2.0)
                elif stype == "theory":
                    await solve_theory(page)
                elif stype == "mcq":
                    await solve_mcq(page)
                elif stype == "coding":
                    await solve_coding(page)
                elif stype == "loading":
                    print("[Runner] Editor or container loading, waiting...")
                    await asyncio.sleep(2.5)
                else:
                    print("[Runner] Unknown screen, attempting Next...")
                    await click_next_button(page)
                    await asyncio.sleep(2.0)

                step += 1
                await asyncio.sleep(1.0)

            except Exception as e:
                print(f"[Runner] Error in loop: {e}")
                await asyncio.sleep(3.0)


if __name__ == "__main__":
    asyncio.run(main())
