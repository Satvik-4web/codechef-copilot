// DOM decisions are kept separate from browser actions so they can be tested.
(function (root) {
  const text = (el) => (el?.innerText || el?.textContent || "").trim();
  const visible = (el) => !!el && (typeof el.getClientRects !== "function" || el.getClientRects().length > 0);
  const qAll = (doc, sel) => Array.from(doc.querySelectorAll ? doc.querySelectorAll(sel) : doc.body?.querySelectorAll ? doc.body.querySelectorAll(sel) : []);
  const qOne = (doc, sel) => doc.querySelector ? doc.querySelector(sel) : doc.body?.querySelector ? doc.body.querySelector(sel) : null;
  const buttons = (doc) => qAll(doc, "button, [role='button'], a, div[class*='btn'], div[class*='button']").filter(visible);
  const hasButton = (doc, pattern) => buttons(doc).some((el) => pattern.test(text(el)));

  function options(doc) {
    const inputs = qAll(doc, "input[type='radio'], input[type='checkbox']");
    if (inputs.length >= 2) {
      const mapped = inputs.map((input) => {
        const target = (typeof input.closest === "function" && input.closest("label")) ||
          (input.id && qOne(doc, `label[for='${CSS.escape(input.id)}']`)) ||
          (typeof input.closest === "function" && input.closest("[class*='option'], [class*='Option'], [class*='choice'], [class*='Choice'], [class*='item'], [class*='Item']")) ||
          input.parentElement || input;
        
        let choiceText = text(target);
        if (target === input.parentElement && input.parentElement && typeof input.parentElement.querySelectorAll === "function") {
          const siblings = Array.from(input.parentElement.querySelectorAll("input[type='radio'], input[type='checkbox']"));
          if (siblings.length > 1) {
            choiceText = text(input.nextSibling) || text(input.parentElement);
          }
        }
        return { target, input, text: choiceText.slice(0, 300) };
      }).filter((choice) => visible(choice.target) && choice.text);

      if (mapped.length >= 2) return mapped;
    }

    const cards = qAll(doc, "label, [role='radio'], [class*='option'], [class*='Option'], [class*='choice'], [class*='Choice'], [class*='mcq-choice']")
      .filter((el) => visible(el) && text(el).length > 0 && text(el).length < 300 &&
        !(el.children && Array.from(el.children).some((child) => child.matches && child.matches("[role='radio'], [class*='option'], [class*='Option'], [class*='choice'], [class*='Choice']"))))
      .map((target) => ({ target, input: (target.querySelector && target.querySelector("input[type='radio']")) || target, text: text(target) }));

    return cards;
  }

  function mcqResult(doc) {
    const rootEl = doc.body || doc;
    const body = text(rootEl);

    // 1. Solved signals in text or buttons (ONLY explicit problem-solved buttons, NEVER generic header 'next')
    if (hasButton(doc, /^move to next problem$/i) ||
        /\b(hooray|you did it|well done|good job|awesome|great job|your answer is correct|you have solved the problem)\b/i.test(body) ||
        /\bcorrect[!.]/i.test(body) ||
        /(?:✓|✔)\s*(?:hooray|you did it|correct|well done)/i.test(body)) {
      return "passed";
    }

    // 2. Check dedicated feedback elements
    const feedbackContainers = qAll(doc, "[class*='feedback'], [class*='result'], [class*='alert'], [class*='status'], [class*='banner'], [class*='success'], [role='alert']");
    const feedbackText = feedbackContainers.map(text).join("\n");
    if (feedbackText) {
      if (/\b(hooray|you did it|correct|well done|good job|awesome)\b/i.test(feedbackText)) return "passed";
      if (/\b(incorrect|wrong answer|try again|not correct)\b/i.test(feedbackText)) return "failed";
    }

    // 3. Specific failure feedback phrases (does not trigger on questions like "Which statement is incorrect?")
    if (/\b(?:your answer is incorrect|wrong answer|try again|incorrect[!.]\s*try again|incorrect\s*answer)\b/i.test(body) ||
        /\bincorrect\.\s*(?:try again|the correct answer)/i.test(body)) {
      return "failed";
    }

    return "pending";
  }

  function localMCQAnswer(source, choices) {
    const wanted = source.match(/which projects? (?:are|is) (classification|regression)/i)?.[1]?.toLowerCase();
    if (!wanted) return null;
    const projects = new Map();
    for (const match of source.matchAll(/^\s*(?:[•*-]\s*)?Project\s+([A-Z])\s*:\s*(.+)$/gim)) {
      const description = match[2];
      const category = /\bwhether\b|\byes\s*(?:or|\/)\s*no\b|\bor\s+not\b|\bfraud\b|\bspam\b|\bpass\s*(?:or|\/)\s*fail\b/i.test(description);
      const number = /\b(amount|weight|price|temperature|score)\b|\bin\s+(?:mm|kg|cm|meters?|rupees?|dollars?)\b/i.test(description);
      if (category === number) return null;
      projects.set(match[1].toUpperCase(), category ? 'classification' : 'regression');
    }
    if (projects.size < 2) return null;
    const expected = [...projects].filter(([, kind]) => kind === wanted).map(([letter]) => letter).sort().join('');
    for (let index = 0; index < choices.length; index++) {
      const option = choices[index].trim().toLowerCase();
      let selected;
      if (option === 'all projects') selected = [...projects.keys()];
      else if (/^(?:project\s+)?[a-z](?:\s*(?:,|and|&)\s*(?:project\s+)?[a-z])*\s*(?:only)?$/.test(option)) {
        selected = option.replace(/\b(?:project|only)\b/g, '').split(/\s*(?:,|\band\b|&)\s*/)
          .map((part) => part.trim().toUpperCase()).filter(Boolean);
      } else continue;
      if (selected.sort().join('') === expected) return index;
    }
    return null;
  }

  function codeResult(doc) {
    const body = text(doc.body || doc);
    const sectionMatch = body.match(/Test results([\s\S]*?)(?:Congratulations|Move to next problem|\bPROBLEMS\b|$)/i);
    const section = sectionMatch ? sectionMatch[1] : body;

    const tests = [];
    const lines = section.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(/^([✓✔✗❌✘])?\s*Test\s*(\d+)\s*:\s*(.+)$/i);
      if (match) {
        const mark = match[1] || "";
        const isPassed = mark === "✓" || mark === "✔";
        const isFailed = mark === "✗" || mark === "❌" || mark === "✘";
        tests.push({ num: match[2], desc: match[3], isPassed, isFailed, raw: trimmed });
      }
    }

    const testSet = new Set(Array.from(section.matchAll(/Test\s+(\d+)\s*:/gi), (m) => m[1]));
    const total = tests.length > 0 ? tests.length : testSet.size;
    const passedCount = tests.filter((t) => t.isPassed).length;
    const failedCount = tests.filter((t) => t.isFailed).length;
    const allTicked = total > 0 && passedCount === total;

    const running = /\brunning tests\b/i.test(section) || /\brunning\.\.\./i.test(body);

    // Solved check: matches both single-line and multiline "Congratulations ... You have solved the problem" and "Move to next problem" button
    const solved = /congratulations[\s\S]{0,100}you have solved the problem/i.test(body) ||
      /you have solved the problem/i.test(body) ||
      hasButton(doc, /^move to next problem$/i) ||
      /\bmove to next problem\b/i.test(body);

    const hasExplicitFailures = failedCount > 0 ||
      /\b(failed|wrong answer|runtime error|compilation error|traceback)\b/i.test(section) ||
      /(?:❌|✘|✗)\s*Test\s*\d+|Test\s*\d+[^\n]{0,80}(?:❌|✘|✗)/i.test(section);

    const isPassed = allTicked || (solved && total > 0 && !hasExplicitFailures);

    return {
      status: running ? "pending" : isPassed ? "passed" : hasExplicitFailures ? "failed" : "pending",
      total,
      passed: passedCount,
      failed: failedCount,
      count: total,
      output: section.slice(0, 3000)
    };
  }

  function classify(doc, url) {
    const choices = options(doc);
    const editor = !!qOne(doc, ".monaco-editor, .view-lines, textarea.inputarea, iframe[src*='workspace']");
    const editorReady = !!qOne(doc, ".monaco-editor .view-lines .view-line, .monaco-editor textarea.inputarea");
    const run = hasButton(doc, /^(run|run code|submit code)$/i);
    const editorLoading = /\b(container creation request|getting your container|connecting to your container|setting up your editor)\b/i.test(text(doc.body || doc));
    
    let isWorkspace = false;
    try {
      const params = new URL(url).searchParams;
      isWorkspace = params.has("folder") || params.get("tab") === "tests";
    } catch (_) {}

    if (choices.length >= 2 && !editor && !run) return { type: "mcq", isPassed: mcqResult(doc) === "passed" };
    if (editorLoading && !editorReady && !run) return { type: "loading", isPassed: false };
    if (editor || run || isWorkspace) return { type: "coding", isPassed: codeResult(doc).status === "passed" };
    if (!qOne(doc, "#problem-statement, .problem-statement, [class*='statement']") &&
        !(text(doc.body || doc).length > 180 && qOne(doc, "h1, h2, h3")))
      return { type: "unknown", isPassed: false };
    return { type: "theory", isPassed: false };
  }

  async function selectAndVerify(choice, { pageKey, result, submit, wait, delay }) {
    const key = pageKey();
    const before = result();

    // 1. Dispatch full native setter and events if input exists (handles React 16+ synthetic events)
    if (choice.input && typeof choice.input === "object") {
      try {
        const proto = typeof window !== "undefined" ? window.HTMLInputElement?.prototype : null;
        const setter = proto ? Object.getOwnPropertyDescriptor(proto, "checked")?.set : null;
        if (setter) {
          setter.call(choice.input, true);
        } else {
          choice.input.checked = true;
        }
        if (typeof choice.input.dispatchEvent === "function") {
          choice.input.dispatchEvent(new Event("input", { bubbles: true }));
          choice.input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } catch (_) {}
    }

    // 2. Click wrapper/card target
    if (choice.target && typeof choice.target.click === "function") {
      choice.target.click();
    }
    if (choice.input && choice.input !== choice.target && typeof choice.input.click === "function") {
      choice.input.click();
    }

    await delay(250);
    if (pageKey() !== key || result() === "passed") return "passed";

    // 3. Click Submit button if present
    const submitButton = submit();
    if (submitButton && result() === "pending") {
      submitButton.click();
    }

    return wait(() => pageKey() !== key ? "passed" : result(), before, 12000, true);
  }

  function codingAttempt(response, editorCode, hasEditor = false) {
    const generated = response?.status === "ok" ? response.data?.generated_code : null;
    if (generated && response.injected) return { code: generated, canHeal: true, testExisting: false, reason: "" };
    if (editorCode?.trim() || hasEditor) return {
      code: editorCode || "", canHeal: false, testExisting: true,
      reason: response?.status === "error" ? response.error :
        response?.status === "ok" ? "Editor injection unavailable" : "Backend unavailable"
    };
    return { code: null, canHeal: false, testExisting: false, reason: response?.error ||
      (generated ? "Editor injection unavailable" : "Code generation unavailable") };
  }

  function shouldTestExistingCode(code) {
    return code?.trim().length >= 80 && !/_{4,}|raise\s+NotImplementedError/i.test(code);
  }

  root.CodeChefCourseFlow = { classify, options, mcqResult, localMCQAnswer, codeResult, selectAndVerify, codingAttempt, shouldTestExistingCode, buttons, text };
})(typeof module !== "undefined" && module.exports ? module.exports : globalThis);
