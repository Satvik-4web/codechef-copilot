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
    const rootEl = doc.body || doc;
    const body = text(rootEl);
    const sectionMatch = body.match(/Test results([\s\S]*?)(?:Congratulations|Move to next problem|\bPROBLEMS\b|$)/i);
    const section = sectionMatch ? sectionMatch[1] : body;

    // 1. Direct Solved check: "Congratulations ... You have solved the problem" or "Move to next problem" button
    const solved = /congratulations[\s\S]{0,100}you have solved the problem/i.test(body) ||
      /you have solved the problem/i.test(body) ||
      hasButton(doc, /^move to next problem$/i) ||
      /\bmove to next problem\b/i.test(body);

    if (solved) {
      return {
        status: "passed",
        total: 1,
        passed: 1,
        failed: 0,
        count: 1,
        output: section.slice(0, 3000)
      };
    }

    const running = /\brunning tests\b/i.test(body) || /\brunning\.\.\./i.test(body);

    // 2. Inspect DOM elements for individual Test items and check their SVG icons / CSS colors
    const allEls = qAll(doc, "li, div, p, span");
    const testRowEls = [];
    for (const el of allEls) {
      const t = text(el);
      if (/^Test\s*\d+\s*:/i.test(t)) {
        // Find leaf container for the test row
        const hasChildTest = Array.from(el.children || []).some((c) => /^Test\s*\d+\s*:/i.test(text(c)));
        if (!hasChildTest) {
          testRowEls.push(el);
        }
      }
    }

    let passedCount = 0;
    let failedCount = 0;
    const testSet = new Set(Array.from(section.matchAll(/Test\s+(\d+)\s*:/gi), (m) => m[1]));
    const total = testRowEls.length > 0 ? testRowEls.length : testSet.size;

    for (const testEl of testRowEls) {
      const row = testEl.closest("li, div[class*='test'], div[class*='row'], div[class*='item']") || testEl.parentElement || testEl;
      const rowHtml = row.outerHTML || "";
      const svgs = Array.from(row.querySelectorAll("svg, i, [class*='icon']"));
      
      let computedColors = "";
      try {
        computedColors += window.getComputedStyle(row).color + " ";
        for (const s of svgs) {
          const cs = window.getComputedStyle(s);
          computedColors += (cs.color || "") + " " + (cs.stroke || "") + " " + (cs.fill || "") + " ";
        }
      } catch (_) {}

      const allInfo = rowHtml + " " + computedColors;

      const isGreen = /green|success|emerald|#22c55e|#10b981|#16a34a|rgb\(34,\s*197,\s*94\)|rgb\(16,\s*185,\s*129\)/i.test(allInfo) ||
                      /(?:✓|✔)/.test(text(row));
      const isRed = /red|fail|error|rose|danger|destructive|#ef4444|#dc2626|#b91c1c|#f87171|rgb\(239,\s*68,\s*68\)|rgb\(248,\s*113,\s*113\)|rgb\(220,\s*38,\s*38\)/i.test(allInfo) ||
                    /(?:✗|❌|✘)/.test(text(row));

      if (isGreen && !isRed) {
        passedCount++;
      } else if (isRed) {
        failedCount++;
      }
    }

    // Also check text-based unicode checkmarks as fallback
    if (passedCount === 0 && failedCount === 0) {
      for (const line of section.split("\n")) {
        const trimmed = line.trim();
        const m = trimmed.match(/^([✓✔✗❌✘])?\s*Test\s*(\d+)\s*:\s*(.+)$/i);
        if (m) {
          const mark = m[1] || "";
          if (mark === "✓" || mark === "✔") passedCount++;
          if (mark === "✗" || mark === "❌" || mark === "✘") failedCount++;
        }
      }
    }

    const hasExplicitFailures = failedCount > 0 ||
      /\b(failed|wrong answer|runtime error|compilation error|traceback|syntaxerror|test failed)\b/i.test(section) ||
      /(?:❌|✘|✗)\s*Test\s*\d+|Test\s*\d+[^\n]{0,80}(?:❌|✘|✗)/i.test(section);

    const allTicked = total > 0 && passedCount === total;
    const isPassed = allTicked || (solved && total > 0 && !hasExplicitFailures);

    let status = "pending";
    if (running) {
      status = "pending";
    } else if (isPassed) {
      status = "passed";
    } else if (hasExplicitFailures || failedCount > 0) {
      status = "failed";
    }

    return {
      status,
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
