// CodeChef Copilot — Autonomous Speedrunner Content Script for codechef.com

(() => {
  if (window.__CODECHEF_COPILOT_INJECTED__) return;
  window.__CODECHEF_COPILOT_INJECTED__ = true;

  console.log("[CodeChef Copilot] Autonomous Speedrunner loaded on CodeChef.");

  let isAutoPilotActive = sessionStorage.getItem("ccc_speedrunner_active") === "true";
  let isSolvingCurrent = false;
  let singleSolveActive = false;
  let lastUrl = location.href;
  let assistantStatusText = "Checking backend...";
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const pageKey = () => new URL(location.href).pathname;
  const label = (el) => (el?.innerText || el?.textContent || "").trim();

  function setStatus(message) {
    const button = document.getElementById("ccc-quick-speedrunner");
    if (button) {
      const lbl = button.querySelector(".ccc-label");
      if (lbl) lbl.textContent = message;
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Problem & Editor Extraction
  // ---------------------------------------------------------------------------
  function extractProblemData() {
    const url = window.location.href;
    const urlMatch = url.match(/\/problems\/([A-Za-z0-9_]+)/i);
    const problemCode = urlMatch ? urlMatch[1] : (document.title.split("|")[0].trim() || "TASK");

    const titleElem = document.querySelector(
      "#problem-statement h1, h1.title, .problem-title h3, h2.title, h1, [class*='ProblemHeader'] h1, [class*='problemName']"
    );
    const title = titleElem ? titleElem.innerText.trim() : problemCode;

    let language = "python";
    let activeFile = "main.py";
    const bodyText = document.body ? document.body.innerText : "";
    if (document.querySelector("[title*='.cpp'], [aria-label*='.cpp']") || (bodyText.includes(".cpp") && !bodyText.includes("main.py"))) {
      language = "cpp";
      activeFile = "solution.cpp";
    }

    const codeBlocks = [];
    const preElements = document.querySelectorAll(
      "#problem-statement pre, .problem-statement pre, pre, [class*='code-block'], code"
    );
    preElements.forEach((el) => {
      const text = el.innerText ? el.innerText.trim() : "";
      if (text.length > 15 && (text.includes("=") || text.includes("def ") || text.includes("import ") || text.includes("#include") || text.includes("print("))) {
        if (!codeBlocks.includes(text)) {
          codeBlocks.push(text);
        }
      }
    });

    const statementElem = document.querySelector(
      "#problem-statement, .problem-statement, div[class*='problem-statement'], #problem-body, [class*='statement']"
    );
    const statement = statementElem ? statementElem.innerText.trim() : bodyText.slice(0, 8000);

    return {
      title,
      problem_code: problemCode,
      url,
      language,
      active_file: activeFile,
      statement: statement.slice(0, 8000),
      extracted_code: codeBlocks.join("\n\n"),
      extracted_at: new Date().toISOString()
    };
  }

  function getCurrentEditorCode() {
    const viewLines = document.querySelectorAll(".view-lines .view-line");
    if (viewLines.length > 0) {
      return Array.from(viewLines).map((l) => l.innerText).join("\n");
    }
    const ta = document.querySelector(".monaco-editor textarea, textarea.inputarea, textarea");
    if (ta && ta.value) return ta.value;
    return "";
  }

  // ---------------------------------------------------------------------------
  // 2. Intelligent Screen Classifier & Editor Loader Waiter
  // ---------------------------------------------------------------------------
  async function waitForEditorReady(timeoutMs = 20000) {
    const startTime = Date.now();
    const speedBtn = document.getElementById("ccc-quick-speedrunner");

    while (Date.now() - startTime < timeoutMs) {
      const hasEditorDOM = !!document.querySelector(
        ".monaco-editor, .view-lines, textarea.inputarea, iframe[src*='workspace']"
      );

      if (hasEditorDOM) {
        await delay(1200);
        return true;
      }

      if (speedBtn && isAutoPilotActive) {
        setStatus("Waiting for editor...");
      }
      await delay(600);
    }
    return false;
  }

  async function classifyScreen() {
    const start = Date.now();
    let screen = CodeChefCourseFlow.classify(document, location.href);

    const isWorkspaceUrl = location.href.includes("folder=") || location.href.includes("tab=tests") || location.href.includes("/workspace");

    while (Date.now() - start < (isWorkspaceUrl ? 25000 : 8000)) {
      screen = CodeChefCourseFlow.classify(document, location.href);

      // If already solved, or mcq detected, or coding editor detected -> done
      if (screen.isPassed) return screen;
      if (screen.type === "mcq" && screen.type !== "theory") return screen;
      if (screen.type === "coding") return screen;

      if (screen.type === "loading" || isWorkspaceUrl) {
        setStatus("Waiting for editor...");
      }

      await delay(800);
    }

    return screen;
  }

  function isSolvedBannerPresent() {
    const body = document.body ? document.body.innerText : "";
    if (/congratulations[\s\S]{0,100}you have solved the problem/i.test(body) ||
        /you have solved the problem/i.test(body) ||
        /\b(hooray|you did it|well done)\b/i.test(body) ||
        /(?:✓|✔)\s*(?:hooray|you did it|correct|well done)/i.test(body)) {
      return true;
    }
    const allButtons = Array.from(document.querySelectorAll("button, [role='button'], a, div, span"));
    return allButtons.some(el => {
      const clean = label(el).toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
      return clean === "move to next problem" || clean === "move to next";
    });
  }

  function triggerSaveFile() {
    const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const saveEvents = [
      new KeyboardEvent("keydown", { key: "s", code: "KeyS", keyCode: 83, which: 83, ctrlKey: !isMac, metaKey: isMac, bubbles: true, cancelable: true, view: window }),
      new KeyboardEvent("keypress", { key: "s", code: "KeyS", keyCode: 83, which: 83, ctrlKey: !isMac, metaKey: isMac, bubbles: true, cancelable: true, view: window }),
      new KeyboardEvent("keyup", { key: "s", code: "KeyS", keyCode: 83, which: 83, ctrlKey: !isMac, metaKey: isMac, bubbles: true, cancelable: true, view: window })
    ];

    const targets = [
      document.activeElement,
      document.querySelector(".monaco-editor textarea, textarea.inputarea, textarea"),
      document.querySelector(".monaco-editor"),
      document.body,
      document,
      window
    ].filter(Boolean);

    for (const target of targets) {
      for (const ev of saveEvents) {
        try { target.dispatchEvent(ev); } catch (_) {}
      }
    }
  }

  function injectCodeDirectly(newCode) {
    const ta = document.querySelector(".monaco-editor textarea, textarea.inputarea, textarea");
    if (ta) {
      ta.focus();
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      ta.dispatchEvent(new KeyboardEvent("keydown", {
        key: "a", code: "KeyA", keyCode: 65, which: 65,
        ctrlKey: !isMac, metaKey: isMac,
        bubbles: true, cancelable: true, view: window
      }));
      try { document.execCommand("selectAll", false, null); } catch (_) {}
      try { document.execCommand("insertText", false, newCode); } catch (_) {}
      triggerSaveFile();
    }
  }

  function readExecutionFeedback() {
    // Only inspect the left sidebar test results container to avoid stale terminal backlog
    const result = CodeChefCourseFlow.codeResult(document);
    const testPanel = document.querySelector("div[class*='test'], div[class*='Test'], #test-results, [class*='test-results']");
    const panelText = (testPanel ? testPanel.innerText : "") || result.output || "";
    const combined = panelText.includes("Test 1") ? panelText : (panelText + "\n" + (result.output || ""));
    return {
      hasError: result.status === "failed",
      errorSnippet: combined.slice(0, 1500),
      fullOutput: combined
    };
  }

  // ---------------------------------------------------------------------------
  // 3. Navigation Helpers (Next Button, Run, Submit)
  // ---------------------------------------------------------------------------
  function getActionButtons() {
    const allButtons = Array.from(document.querySelectorAll("button, [role='button'], a, div[class*='btn'], div[class*='button']"));

    const submitBtn = allButtons.find((b) => {
      const t = label(b).trim().toLowerCase();
      return t === "submit" || t === "submit code" || t === "submit answer";
    }) || allButtons.find((b) => label(b).trim().toLowerCase().startsWith("submit"));

    const runBtn = allButtons.find((b) => {
      const t = label(b).trim().toLowerCase();
      return t === "run" || t === "run code" || t === "▶ run" || (t.includes("run") && !t.includes("running"));
    });

    const nextBtn = allButtons.find((b) => {
      const t = label(b).trim().toLowerCase();
      return t === "move to next problem" || t === "next" || t === "next >" || t === "next module" || t === "next module >";
    });

    return { submitBtn, runBtn, nextBtn };
  }

  async function clickSubmitButton() {
    triggerSaveFile();
    await delay(300);
    const { submitBtn } = getActionButtons();
    if (submitBtn) {
      submitBtn.scrollIntoView({ behavior: "smooth", block: "center" });
      submitBtn.click();
      console.log("[CodeChef Copilot] Clicked Submit button!");
      return true;
    }
    return false;
  }

  async function clickRunButton() {
    triggerSaveFile();
    await delay(300);
    const { runBtn } = getActionButtons();
    if (runBtn) {
      runBtn.scrollIntoView({ behavior: "smooth", block: "center" });
      runBtn.click();
      console.log("[CodeChef Copilot] Clicked Run button!");
      return true;
    }
    return false;
  }

  function isNextButtonText(rawText) {
    if (!rawText) return false;
    const clean = rawText.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
    return clean === "move to next problem" || clean === "move to next" ||
           clean === "next" || clean === "next module" || clean === "next problem" || clean === "next question";
  }

  function triggerClick(el) {
    if (!el) return false;
    try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (_) {}

    const opts = { bubbles: true, cancelable: true, view: window, buttons: 1 };
    try { el.dispatchEvent(new PointerEvent("pointerdown", opts)); } catch (_) {}
    try { el.dispatchEvent(new MouseEvent("mousedown", opts)); } catch (_) {}
    try { el.dispatchEvent(new PointerEvent("pointerup", opts)); } catch (_) {}
    try { el.dispatchEvent(new MouseEvent("mouseup", opts)); } catch (_) {}
    try { el.dispatchEvent(new MouseEvent("click", opts)); } catch (_) {}
    try { el.click(); } catch (_) {}

    const clickableParent = el.closest("button, [role='button'], a");
    if (clickableParent && clickableParent !== el) {
      try { clickableParent.dispatchEvent(new MouseEvent("click", opts)); } catch (_) {}
      try { clickableParent.click(); } catch (_) {}
    }

    return true;
  }

  function clickNextModule() {
    console.log("[CodeChef Copilot] Finding Next button to advance...");

    // Find all candidate elements, excluding outer containers with many children
    const candidates = Array.from(document.querySelectorAll(
      "button, [role='button'], a, div, span"
    )).filter((el) => {
      if (el.children && el.children.length > 3) return false;
      return isNextButtonText(label(el));
    });

    // 1. Priority: "Move to next problem" button in the test results banner
    const bannerNext = candidates.find((el) => {
      const clean = label(el).toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
      return clean === "move to next problem" || clean === "move to next";
    });

    if (bannerNext) {
      console.log("[CodeChef Copilot] Found 'Move to next problem' button, clicking:", bannerNext);
      triggerClick(bannerNext);
      return true;
    }

    // 2. Priority: Top header "Next" / "Next module" button
    const headerNext = candidates.find((el) => {
      const clean = label(el).toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
      return clean === "next" || clean === "next module" || clean === "next problem";
    });

    if (headerNext) {
      console.log("[CodeChef Copilot] Found header 'Next' button, clicking:", headerNext);
      triggerClick(headerNext);
      return true;
    }

    // 3. Fallback: Any next button
    const fallbackNext = Array.from(document.querySelectorAll("button, [role='button'], a")).find((el) => {
      const t = label(el).toLowerCase();
      return (t.includes("next module") || t.includes("next problem") || t.startsWith("next")) && !t.includes("prev");
    });

    if (fallbackNext) {
      console.log("[CodeChef Copilot] Clicking fallback Next element:", fallbackNext);
      triggerClick(fallbackNext);
      return true;
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // 4. API Request Helper
  // ---------------------------------------------------------------------------
  function request(action, payload) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ action, payload }, (response) =>
          resolve(chrome.runtime.lastError ? null : response));
      } catch (_) { resolve(null); }
    });
  }

  async function waitForResult(reader, previous = "pending", timeout = 40000) {
    const start = Date.now();
    let sawPending = previous === "pending";
    while (Date.now() - start < timeout && (isAutoPilotActive || singleSolveActive)) {
      if (isSolvedBannerPresent()) return "passed";

      const value = reader();
      if (value === "pending") sawPending = true;
      if (value !== "pending" && (sawPending || value !== previous)) return value;
      await delay(500);
    }
    return isSolvedBannerPresent() ? "passed" : "pending";
  }

  // ---------------------------------------------------------------------------
  // 5. MCQ Auto-Solver
  // ---------------------------------------------------------------------------
  async function completeMCQ() {
    let choices = CodeChefCourseFlow.options(document);
    if (choices.length < 2) {
      await delay(1200);
      choices = CodeChefCourseFlow.options(document);
    }
    if (choices.length < 2) return false;

    // Check if already passed
    if (CodeChefCourseFlow.mcqResult(document) === "passed") {
      setStatus("MCQ already solved!");
      await delay(600);
      clickNextModule();
      return true;
    }

    const questionElem = document.querySelector("#problem-statement, .problem-statement, [class*='question']");
    const questionText = questionElem ? label(questionElem) : label(document.body).slice(0, 1500);
    const context = label(document.body).slice(0, 3000);
    const optionTexts = choices.map((choice) => choice.text);

    setStatus("Solving MCQ with AI...");
    const local = CodeChefCourseFlow.localMCQAnswer(`${questionText}\n${context}`, optionTexts);
    const response = local === null ? await request("CALL_SOLVE_MCQ", {
      question: questionText, options: optionTexts, context
    }) : null;

    let preferred = local ?? (response?.status === "ok" ? response.data?.correct_option_index : 0);
    if (!Number.isInteger(preferred) || preferred < 0 || preferred >= choices.length) {
      preferred = 0;
    }

    const order = [preferred, ...choices.map((_, i) => i).filter((i) => i !== preferred)];

    for (const index of order) {
      if (!isAutoPilotActive && !singleSolveActive) return false;
      setStatus(`Trying option ${index + 1}/${choices.length}...`);

      const result = await CodeChefCourseFlow.selectAndVerify(choices[index], {
        pageKey,
        result: () => CodeChefCourseFlow.mcqResult(document),
        submit: () => {
          const btns = Array.from(document.querySelectorAll("button, [role='button'], a, div[class*='btn']"));
          return btns.find((b) => /^(submit|submit answer|check|check answer|confirm|verify)$/i.test(label(b)));
        },
        wait: waitForResult,
        delay
      });

      if (result === "passed" || isSolvedBannerPresent()) {
        setStatus("MCQ Solved! Next...");
        await delay(800);
        clickNextModule();
        return true;
      }

      await delay(500);
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // 6. Coding Auto-Solver & Self-Healer
  // ---------------------------------------------------------------------------
  async function completeCoding() {
    // 1. Check if already solved!
    if (isSolvedBannerPresent() || CodeChefCourseFlow.codeResult(document).status === "passed") {
      setStatus("Solved! Advancing...");
      await delay(600);
      clickNextModule();
      return true;
    }

    if (!(await waitForEditorReady(18000))) {
      setStatus("Waiting for editor to mount...");
      return false;
    }

    const { submitBtn, runBtn } = getActionButtons();

    // 2. WORKED EXAMPLE / UNGRADED DEMO:
    // If there is NO Submit button, but Run button exists:
    // This is a tutorial lab / worked example (like Logistic Regression Worked Example YTQAI86).
    // There are NO tests to grade or fail!
    if (!submitBtn && runBtn) {
      console.log("[CodeChef Copilot] Worked Example detected (no Submit button). Running code in terminal...");
      setStatus("Running worked example...");
      await clickRunButton();
      await delay(3500); // Give python code time to execute in terminal
      setStatus("Example executed! Next...");
      await delay(800);
      clickNextModule();
      return true;
    }

    // 3. GRADED PROBLEM (Submit button exists):
    const problem = extractProblemData();
    const editorCode = getCurrentEditorCode();

    // Check if existing code can be tested directly
    if (CodeChefCourseFlow.shouldTestExistingCode(editorCode) &&
        CodeChefCourseFlow.codeResult(document).status === "pending") {
      setStatus("Testing existing code...");
      if (await clickSubmitButton()) {
        const existingResult = await waitForResult(() =>
          CodeChefCourseFlow.codeResult(document).status, "pending", 30000);
        if (existingResult === "passed" || isSolvedBannerPresent()) {
          setStatus("Passed! Advancing...");
          await delay(800);
          clickNextModule();
          return true;
        }
      }
    }

    setStatus("Generating AI solution...");
    const initial = await request("CALL_AUTO_SOLVE", {
      problem_statement: problem.statement,
      extracted_code: problem.extracted_code,
      editor_code: editorCode,
      language: problem.language,
      title: problem.title,
      user_confirmed_allowed: true
    });

    const attemptPlan = CodeChefCourseFlow.codingAttempt(
      initial,
      editorCode,
      !!document.querySelector(".monaco-editor, .view-lines, iframe[src*='workspace']")
    );

    let code = attemptPlan.code;

    // Submit and self-heal loop (up to 3 healing attempts)
    for (let attempt = 0; attempt <= 3; attempt++) {
      if (!isAutoPilotActive && !singleSolveActive) return false;

      // Check if already passed before submitting
      if (isSolvedBannerPresent() || CodeChefCourseFlow.codeResult(document).status === "passed") {
        setStatus("Passed! Advancing...");
        await delay(800);
        clickNextModule();
        return true;
      }

      setStatus(attempt === 0 ? "Submitting code..." : `Fixing tests (${attempt}/3)...`);
      await delay(600);

      // Submit code
      const submitted = await clickSubmitButton();
      if (!submitted) {
        await clickRunButton();
      }

      // Wait loop: Poll every 600ms until all tests on screen have green ticks!
      const start = Date.now();
      let passed = false;
      while (Date.now() - start < 45000 && (isAutoPilotActive || singleSolveActive)) {
        const tests = CodeChefCourseFlow.codeResult(document);

        if (tests.total > 0) {
          setStatus(`Tests: ${tests.passed}/${tests.total} ticked`);
        }

        if (tests.status === "passed" || isSolvedBannerPresent()) {
          console.log("[CodeChef Copilot] All tests ticked! Solved!");
          setStatus("All tests ticked! Next...");
          await delay(800);
          clickNextModule();
          passed = true;
          break;
        }

        // If explicit test failures detected after settling, break to self-heal
        if (tests.status === "failed" && Date.now() - start > 2500) {
          console.log("[CodeChef Copilot] Test failures detected. Self-healing...");
          break;
        }

        await delay(600);
      }

      if (passed) return true;

      if (attempt === 3) break;

      // Self-heal on failure
      const feedback = readExecutionFeedback();
      const currentCodeInEditor = getCurrentEditorCode() || code;

      setStatus(`Self-healing tests (${attempt + 1}/3)...`);
      const healed = await request("CALL_AUTO_HEAL", {
        problem_statement: problem.statement,
        current_code: currentCodeInEditor,
        error_output: feedback.errorSnippet || feedback.fullOutput,
        language: problem.language,
        title: problem.title
      });

      const fixed = healed?.status === "ok" ? healed.data?.fixed_code : null;
      if (fixed) {
        code = fixed;
        if (!healed.injected) {
          injectCodeDirectly(fixed);
        }
        triggerSaveFile();
        await delay(800);
      }
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // 7. Continuous Speedrunner Engine (Hands-Free Loop)
  // ---------------------------------------------------------------------------
  async function runSpeedrunnerStep() {
    if (!isAutoPilotActive || isSolvingCurrent) return;
    isSolvingCurrent = true;

    try {
      const startingPage = pageKey();

      // Check if problem already solved right now
      if (isSolvedBannerPresent() || CodeChefCourseFlow.codeResult(document).status === "passed" || CodeChefCourseFlow.mcqResult(document) === "passed") {
        console.log("[CodeChef Copilot] Solved banner already present! Advancing...");
        setStatus("Solved! Advancing...");
        clickNextModule();
        await delay(1500);
        if (pageKey() === startingPage) {
          // If still on the same page, also trigger header Next button directly
          const headerBtn = Array.from(document.querySelectorAll("button, [role='button'], a")).find((el) => {
            const clean = label(el).toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
            return clean === "next" || clean === "next module" || clean === "next question";
          });
          if (headerBtn) {
            console.log("[CodeChef Copilot] Secondary click on header Next button...");
            triggerClick(headerBtn);
          }
        }
        return;
      }

      const screen = await classifyScreen();
      if (!isAutoPilotActive || pageKey() !== startingPage) return;
      console.log("[CodeChef Copilot] Speedrunner screen detected:", screen);

      if (screen.isPassed || isSolvedBannerPresent() || CodeChefCourseFlow.mcqResult(document) === "passed") {
        console.log("[CodeChef Copilot] Task passed! Advancing to next...");
        setStatus("Passed! Next...");
        await delay(800);
        clickNextModule();
      } else if (screen.type === "mcq") {
        const key = pageKey();
        const passed = await completeMCQ();
        if (passed && pageKey() === key) {
          await delay(600);
          clickNextModule();
        }
      } else if (screen.type === "coding") {
        const key = pageKey();
        const passed = await completeCoding();
        if (passed && pageKey() === key) {
          await delay(600);
          clickNextModule();
        }
      } else if (screen.type === "theory") {
        // Reading module: Skip immediately
        setStatus("Theory: Skipping...");
        const markReadBtn = Array.from(document.querySelectorAll("button, a")).find((b) =>
          /^(mark as read|mark as complete|continue|got it)$/i.test(label(b))
        );
        if (markReadBtn) {
          triggerClick(markReadBtn);
          await delay(300);
        }
        clickNextModule();
      } else if (screen.type === "loading") {
        setStatus("Waiting for editor...");
      }
    } catch (err) {
      console.warn("[CodeChef Copilot] Speedrunner step notice:", err);
    } finally {
      isSolvingCurrent = false;
      const speedBtn = document.getElementById("ccc-quick-speedrunner");
      if (speedBtn && isAutoPilotActive) {
        setStatus("Auto-Pilot: ON");
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Floating UI Controls
  // ---------------------------------------------------------------------------
  function injectFloatingWidget() {
    if (document.getElementById("codechef-copilot-launcher")) return;
    if (!document.body) {
      setTimeout(injectFloatingWidget, 250);
      return;
    }

    const launcher = document.createElement("div");
    launcher.id = "codechef-copilot-launcher";
    launcher.innerHTML = `
      <div class="ccc-pill-btn solve-btn" id="ccc-quick-solve" title="Auto-Solve current question once">
        <span style="font-size: 14px;">⚡</span>
        <span class="ccc-label">Auto-Solve</span>
      </div>
      <div class="ccc-pill-btn speedrunner-btn ${isAutoPilotActive ? 'active' : ''}" id="ccc-quick-speedrunner" title="Full Hands-Free Auto-Pilot: Solves & Advances through MCQs, Theory & Code automatically with Self-Healing">
        <span style="font-size: 14px;">🚀</span>
        <span class="ccc-label">Auto-Pilot: ${isAutoPilotActive ? 'ON' : 'OFF'}</span>
      </div>
      <div class="ccc-pill-btn" id="ccc-main-pill" title="CodeChef Copilot Active">
        <svg class="ccc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        <span class="ccc-label">Copilot</span>
        <span class="ccc-badge">AI</span>
      </div>
    `;

    document.body.appendChild(launcher);
    request("GET_ASSISTANT_STATUS", {}).then((response) => {
      const pill = document.getElementById("ccc-main-pill");
      if (!pill) return;
      if (response?.status === "ok") {
        const { provider, api_key_configured } = response.data;
        assistantStatusText = `Backend online; provider: ${provider}; API key configured: ${api_key_configured ? "yes" : "no"}.`;
        pill.querySelector(".ccc-badge").textContent = api_key_configured ? "AI" : "OFF";
      } else {
        assistantStatusText = "Backend offline at 127.0.0.1:8008.";
        pill.querySelector(".ccc-badge").textContent = "OFF";
      }
      pill.title = assistantStatusText;
    });

    // Button 1: Single Question Auto-Solve
    document.getElementById("ccc-quick-solve").addEventListener("click", async () => {
      const btn = document.getElementById("ccc-quick-solve");
      const originalText = btn.innerHTML;
      btn.innerHTML = `<span style="font-size: 12px;">⏳</span> <span class="ccc-label">Solving...</span>`;

      singleSolveActive = true;
      try {
        const screen = await classifyScreen();
        const passed = screen.type === "mcq" ? await completeMCQ() :
          screen.type === "coding" ? await completeCoding() : false;
        btn.querySelector(".ccc-label").textContent = screen.type === "theory" ? "Theory: Done" :
          passed ? "Verified" : "Done";
      } finally {
        singleSolveActive = false;
        setTimeout(() => { btn.innerHTML = originalText; }, 3500);
      }
    });

    // Button 2: Toggle Hands-Free Auto-Pilot (Speedrunner)
    const speedBtn = document.getElementById("ccc-quick-speedrunner");
    speedBtn.addEventListener("click", () => {
      isAutoPilotActive = !isAutoPilotActive;
      if (isAutoPilotActive) {
        sessionStorage.setItem("ccc_speedrunner_active", "true");
        speedBtn.classList.add("active");
        setStatus("Auto-Pilot: ON");
        runSpeedrunnerStep();
      } else {
        sessionStorage.removeItem("ccc_speedrunner_active");
        speedBtn.classList.remove("active");
        setStatus("Auto-Pilot: OFF");
      }
    });

    // Button 3: Main Copilot Icon
    document.getElementById("ccc-main-pill").addEventListener("click", () => {
      alert(assistantStatusText);
    });

    if (isAutoPilotActive) {
      setTimeout(runSpeedrunnerStep, 2000);
    }
  }

  // ---------------------------------------------------------------------------
  // 9. SPA Navigation Listener & Watchdog Timer
  // ---------------------------------------------------------------------------
  new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      console.log("[CodeChef Copilot] Navigation detected:", currentUrl);
      if (isAutoPilotActive) {
        setStatus("Loading Module...");
        setTimeout(runSpeedrunnerStep, 2500);
      }
    }
  }).observe(document, { subtree: true, childList: true });

  // Watchdog timer: If autopilot is active and idle, periodically ensure continuous advancement
  setInterval(async () => {
    if (isAutoPilotActive && !isSolvingCurrent) {
      runSpeedrunnerStep();
    }
  }, 4000);

  // Handle messages from sidepanel
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "GET_COURSE_STATUS") {
      const screen = CodeChefCourseFlow.classify(document, location.href);
      sendResponse({ status: "ok", data: { ...screen,
        codeResult: CodeChefCourseFlow.codeResult(document) } });
      return true;
    }
    if (request.action === "EXTRACT_PROBLEM") {
      const data = extractProblemData();
      sendResponse({ status: "ok", data });
      return true;
    }
    if (request.action === "TOGGLE_SPEEDRUNNER") {
      isAutoPilotActive = !!request.active;
      if (isAutoPilotActive) {
        sessionStorage.setItem("ccc_speedrunner_active", "true");
        setTimeout(runSpeedrunnerStep, 800);
      } else {
        sessionStorage.removeItem("ccc_speedrunner_active");
      }
      sendResponse({ status: "ok", active: isAutoPilotActive });
      return true;
    }
    sendResponse({ status: "ok" });
    return true;
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectFloatingWidget);
  } else {
    injectFloatingWidget();
  }
})();
