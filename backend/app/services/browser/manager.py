import os
import re
import asyncio
from typing import Optional, Dict, Any, List
from pathlib import Path
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright, BrowserContext, Page, Playwright
from app.config import settings
from app.services.browser.codechef_selectors import (
    CHALLENGE_INDICATORS,
    TASK_LINK_SELECTORS,
    SUBMISSION_EDITOR_SELECTORS,
    SUBMIT_BUTTON_SELECTORS,
    VERDICT_CONTAINER_SELECTORS,
)

class BrowserManager:
    """
    Manages a persistent, dedicated Chromium browser context for CodeChef Copilot.
    Strictly educational: does NOT scrape private APIs, bypass CAPTCHAs, or submit
    without explicit per-task user authorization.
    """
    _instance: Optional["BrowserManager"] = None

    def __init__(self):
        self.playwright: Optional[Playwright] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.is_running: bool = False
        self._lock = asyncio.Lock()

    @classmethod
    def get_instance(cls) -> "BrowserManager":
        if cls._instance is None:
            cls._instance = BrowserManager()
        return cls._instance

    async def launch(self, headless: Optional[bool] = None) -> Dict[str, Any]:
        async with self._lock:
            if self.is_running and self.page and not self.page.is_closed():
                return {
                    "running": True,
                    "message": "Browser is already active",
                    "current_url": self.page.url,
                    "current_title": await self.page.title()
                }

            use_headless = headless if headless is not None else settings.BROWSER_HEADLESS
            profile_path = Path(settings.BROWSER_PROFILE_DIR).resolve()
            profile_path.mkdir(parents=True, exist_ok=True)

            self.playwright = await async_playwright().start()
            self.context = await self.playwright.chromium.launch_persistent_context(
                user_data_dir=str(profile_path),
                headless=use_headless,
                viewport={"width": 1280, "height": 850},
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-first-run",
                    "--no-default-browser-check"
                ]
            )

            if len(self.context.pages) > 0:
                self.page = self.context.pages[0]
            else:
                self.page = await self.context.new_page()

            if self.page.url == "about:blank":
                try:
                    await self.page.goto("https://www.codechef.com", timeout=15000)
                except Exception:
                    pass

            self.is_running = True
            title = await self.page.title() if self.page else ""
            url = self.page.url if self.page else ""

            return {
                "running": True,
                "message": "Dedicated browser window launched successfully",
                "current_url": url,
                "current_title": title
            }

    async def close(self) -> Dict[str, Any]:
        async with self._lock:
            if not self.is_running:
                return {"running": False, "message": "Browser is not running"}

            try:
                if self.context:
                    await self.context.close()
                if self.playwright:
                    await self.playwright.stop()
            except Exception:
                pass
            finally:
                self.playwright = None
                self.context = None
                self.page = None
                self.is_running = False

            return {"running": False, "message": "Browser closed"}

    async def get_status(self) -> Dict[str, Any]:
        if not self.is_running or not self.page or self.page.is_closed():
            self.is_running = False
            return {
                "running": False,
                "current_url": None,
                "current_title": None,
                "is_challenge_detected": False,
                "message": "Browser disconnected"
            }

        try:
            url = self.page.url
            title = await self.page.title()
            content = await self.page.content()
            challenge = any(marker.lower() in content.lower() for marker in CHALLENGE_INDICATORS)

            return {
                "running": True,
                "current_url": url,
                "current_title": title,
                "is_challenge_detected": challenge,
                "message": (
                    "Security challenge / CAPTCHA detected. Please complete it manually in the browser window."
                    if challenge else "Connected to active browser page"
                )
            }
        except Exception as e:
            return {
                "running": False,
                "current_url": None,
                "current_title": None,
                "is_challenge_detected": False,
                "message": f"Error querying browser status: {str(e)}"
            }

    async def capture_current_page(self) -> Dict[str, Any]:
        if not self.is_running or not self.page or self.page.is_closed():
            raise RuntimeError("Dedicated browser is not running. Launch it first.")

        content = await self.page.content()
        challenge = any(marker.lower() in content.lower() for marker in CHALLENGE_INDICATORS)
        if challenge:
            return {
                "url": self.page.url,
                "title": await self.page.title(),
                "html": content,
                "is_challenge_detected": True
            }

        await self.page.bring_to_front()
        return {
            "url": self.page.url,
            "title": await self.page.title(),
            "html": content,
            "is_challenge_detected": False
        }

    async def navigate(self, url: str) -> Dict[str, Any]:
        if not self.is_running or not self.page or self.page.is_closed():
            raise RuntimeError("Dedicated browser is not running. Launch it first.")

        await self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
        return {
            "url": self.page.url,
            "title": await self.page.title()
        }

    @classmethod
    def discover_tasks_from_html(cls, html: str, source_url: str = "https://www.codechef.com") -> List[Dict[str, Any]]:
        """
        Extracts visible practice task rows, problem codes, and links from visible HTML.
        Used by live browser discovery and test fixtures.
        """
        soup = BeautifulSoup(html, "html.parser")
        tasks: List[Dict[str, Any]] = []
        seen_urls = set()

        # 1. Search for table rows with links
        rows = soup.find_all(["tr", "div", "li"])
        for r in rows:
            link = r.find("a", href=re.compile(r"/problems/([A-Za-z0-9_]+)"))
            if not link:
                continue

            href = link.get("href", "")
            full_url = urljoin(source_url, href)
            if full_url in seen_urls:
                continue
            seen_urls.add(full_url)

            # Determine title & code
            text = link.get_text(strip=True)
            code_match = re.search(r"/problems/([A-Za-z0-9_]+)", href)
            code = code_match.group(1) if code_match else "TASK"
            title = text if text and text != code else f"Problem {code}"

            # Detect visible status (e.g. checkmark, "Solved", "Partially", "Attempted")
            row_text = r.get_text(" ", strip=True).lower()
            status = "Unattempted"
            if "solved" in row_text or "correct" in row_text or "100" in row_text:
                status = "Solved"
            elif "partially" in row_text:
                status = "Partially Solved"
            elif "attempted" in row_text or "wrong" in row_text:
                status = "Attempted"

            # Check for course / assignment grouping
            group = ""
            parent_section = r.find_parent(["section", "div"], class_=re.compile(r"(chapter|module|group|assignment)", re.I))
            if parent_section:
                h = parent_section.find(["h2", "h3", "h4"])
                if h:
                    group = h.get_text(strip=True)

            tasks.append({
                "title": title,
                "url": full_url,
                "visible_status": status,
                "course_group": group or "Practice Tasks",
                "parser_confidence": 0.9 if title and full_url else 0.5
            })

        # 2. Direct anchor links if table structure wasn't used
        if not tasks:
            for a in soup.find_all("a", href=re.compile(r"/problems/([A-Za-z0-9_]+)")):
                href = a.get("href", "")
                full_url = urljoin(source_url, href)
                if full_url in seen_urls:
                    continue
                seen_urls.add(full_url)
                text = a.get_text(strip=True)
                match = re.search(r"/problems/([A-Za-z0-9_]+)", href)
                code = match.group(1) if match else "TASK"
                tasks.append({
                    "title": text or f"Problem {code}",
                    "url": full_url,
                    "visible_status": "Unattempted",
                    "course_group": "General Practice",
                    "parser_confidence": 0.75
                })

        return tasks

    async def discover_visible_tasks(self, source_url: Optional[str] = None) -> Dict[str, Any]:
        """
        Discovers tasks visible on the active dedicated browser page.
        """
        capture = await self.capture_current_page()
        url = source_url or capture["url"]
        html = capture["html"]
        tasks = self.discover_tasks_from_html(html, source_url=url)
        return {
            "source_url": url,
            "title": capture.get("title", "CodeChef Task Discovery"),
            "is_challenge_detected": capture.get("is_challenge_detected", False),
            "tasks": tasks
        }

    async def automate_submission(self, destination_url: str, source_code: str) -> Dict[str, Any]:
        """
        Executes an authorized, explicitly confirmed submission through the visible browser interface.
        Strict safeguards: halts if challenge detected, verifies submit button positively.
        Records only visible verdict or PENDING.
        """
        if not self.is_running or not self.page or self.page.is_closed():
            raise RuntimeError("Dedicated browser is not running. Launch it first.")

        # Ensure submit URL format
        target_url = destination_url
        if "/problems/" in target_url and "/submit/" not in target_url:
            target_url = target_url.replace("/problems/", "/submit/")

        await self.page.goto(target_url, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(2)

        # Challenge check
        content = await self.page.content()
        if any(marker.lower() in content.lower() for marker in CHALLENGE_INDICATORS):
            return {
                "success": False,
                "visible_verdict": "CHALLENGE_DETECTED",
                "message": "Security challenge / Cloudflare prompt detected. Please resolve in the browser window."
            }

        # Try to locate editor and fill source code
        filled = False
        for sel in SUBMISSION_EDITOR_SELECTORS:
            el = await self.page.query_selector(sel)
            if el:
                try:
                    await el.click()
                    # Use page keyboard shortcut or evaluate to paste code safely
                    await self.page.evaluate(
                        "([code]) => { "
                        "  const ta = document.querySelector('textarea.inputarea') || document.querySelector('textarea'); "
                        "  if (ta) { ta.value = code; ta.dispatchEvent(new Event('input', { bubbles: true })); } "
                        "}",
                        [source_code]
                    )
                    filled = True
                    break
                except Exception:
                    pass

        # Locate submit button
        submit_btn = None
        for sel in SUBMIT_BUTTON_SELECTORS:
            btn = await self.page.query_selector(sel)
            if btn:
                submit_btn = btn
                break

        if not submit_btn:
            return {
                "success": False,
                "visible_verdict": "SUBMIT_CONTROL_NOT_FOUND",
                "message": "Could not positively identify the visible Submit button. Manual submission guidance activated."
            }

        # Click submit control
        await submit_btn.click()
        await asyncio.sleep(4)

        # Observe visible verdict
        verdict = "PENDING"
        verdict_content = await self.page.content()
        upper_content = verdict_content.upper()
        if "ACCEPTED" in upper_content or "CORRECT ANSWER" in upper_content:
            verdict = "ACCEPTED"
        elif "WRONG ANSWER" in upper_content:
            verdict = "WRONG_ANSWER"
        elif "TIME LIMIT EXCEEDED" in upper_content or "TLE" in upper_content:
            verdict = "TIME_LIMIT_EXCEEDED"
        elif "COMPILATION ERROR" in upper_content:
            verdict = "COMPILATION_ERROR"
        elif "RUNTIME ERROR" in upper_content:
            verdict = "RUNTIME_ERROR"

        return {
            "success": True,
            "visible_verdict": verdict,
            "destination_url": target_url,
            "message": f"Submission executed. Observed platform verdict: {verdict}"
        }
