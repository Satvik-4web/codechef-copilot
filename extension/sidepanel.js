// CodeChef Copilot — Side Panel Controller & Fast Auto-Pilot Engine

const BACKEND_URL = "http://127.0.0.1:8000";

let activeProblem = null;
let isRunningAutoPilot = false;

// DOM Elements
const statusBadge = document.getElementById("statusBadge");
const statusText = document.getElementById("statusText");
const problemTitle = document.getElementById("problemTitle");
const problemCode = document.getElementById("problemCode");
const langBadge = document.getElementById("langBadge");
const btnSync = document.getElementById("btnSync");
const contentArea = document.getElementById("contentArea");

// Auto-Pilot elements
const btnAutoSolveRun = document.getElementById("btnAutoSolveRun");
const btnAutoSolveSubmit = document.getElementById("btnAutoSolveSubmit");
const btnNext = document.getElementById("btnNext");
const chkAutoNext = document.getElementById("chkAutoNext");
const autoPilotStatus = document.getElementById("autoPilotStatus");

// API Key Elements
const inputApiKey = document.getElementById("inputApiKey");
const btnSaveKey = document.getElementById("btnSaveKey");
const keySavedMsg = document.getElementById("keySavedMsg");

// Action buttons
const btnExplain = document.getElementById("btnExplain");
const btnHints = document.getElementById("btnHints");
const btnApproach = document.getElementById("btnApproach");
const btnReview = document.getElementById("btnReview");

// Check Backend Health
async function checkBackendHealth() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`, { method: "GET" });
    if (res.ok) {
      statusBadge.className = "status-badge";
      statusText.innerText = "Connected";
      return true;
    }
  } catch (err) {
    statusBadge.className = "status-badge offline";
    statusText.innerText = "Offline";
    return false;
  }
}

// Render helper
function renderContent(html) {
  contentArea.innerHTML = html;
}

function showLoading(label = "Thinking...") {
  renderContent(`
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 25px 0; gap: 10px; color: var(--text-muted);">
      <div class="spinner"></div>
      <div>${label}</div>
    </div>
  `);
}

// Save API Key to local storage and backend
btnSaveKey.addEventListener("click", async () => {
  const key = inputApiKey.value.trim();
  if (!key) return;

  try {
    const provider = key.startsWith("sk-") ? "openai" : "gemini";
    const res = await fetch(`${BACKEND_URL}/api/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ai_api_key: key, ai_provider: provider })
    });
    if (res.ok) {
      keySavedMsg.style.display = "block";
      keySavedMsg.innerText = `Saved! ${provider.toUpperCase()} activated.`;
      setTimeout(() => { keySavedMsg.style.display = "none"; }, 3000);
    }
  } catch (e) {
    alert("Could not save to backend: " + e.message);
  }
});

// ---------------- SCRIPTING HELPERS (CSP-SAFE) ---------------- //

// Read current code directly from Monaco / Ace editor in page's MAIN context
async function getEditorCode(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      world: "MAIN",
      func: () => {
        // 1. Monaco Editor
        const monacoObj = window.monaco || (typeof window.require === "function" && window.require.defined && window.require.defined("vs/editor/editor.main") ? window.require("vs/editor/editor.main") : null);
        if (monacoObj && monacoObj.editor) {
          const models = monacoObj.editor.getModels();
          if (models && models.length > 0) {
            const target = models.find(m => {
              const p = (m.uri ? m.uri.path : "").toLowerCase();
              return p.endsWith(".py") || p.endsWith(".cpp") || p.includes("workspace") || p.includes("main");
            }) || models[0];
            return target.getValue();
          }
          const eds = monacoObj.editor.getEditors();
          if (eds && eds.length > 0) return eds[0].getValue();
        }
        // 2. Ace Editor
        const aceElem = document.querySelector(".ace_editor");
        if (aceElem && window.ace) {
          const ed = window.ace.edit(aceElem);
          if (ed) return ed.getValue();
        }
        // 3. Monaco visible text lines
        const viewLines = document.querySelectorAll(".view-lines .view-line");
        if (viewLines && viewLines.length > 0) {
          return Array.from(viewLines).map(l => l.innerText).join("\n");
        }
        // 4. Textarea
        const ta = document.querySelector(".monaco-editor textarea, textarea.inputarea, textarea");
        return ta ? ta.value : "";
      }
    });
    if (results && results.length > 0) {
      for (const r of results) {
        if (r && r.result && r.result.trim().length > 0) {
          return r.result;
        }
      }
    }
    return "";
  } catch (e) {
    console.warn("Could not read editor via scripting:", e);
    return "";
  }
}

// Inject code directly into Monaco / Ace editor in page's MAIN context across all frames
async function injectCodeToPage(tabId, codeToInject) {
  if (!codeToInject) return { success: false };
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'INJECT_CODE', tabId, code: codeToInject }, (response) => {
      resolve(chrome.runtime.lastError ? { success: false, error: chrome.runtime.lastError.message } :
        { success: response?.status === 'ok' && response.replaced === true,
          error: response?.error || '' });
    });
  });
}

// Click the "Run" button on the CodeChef interface
async function clickRunOnPage(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      world: "MAIN",
      func: () => {
        const buttons = Array.from(document.querySelectorAll("button, [role='button'], a"));
        const runBtn = buttons.find((b) => {
          const t = (b.innerText || b.textContent || "").trim();
          return t === "Run" || t === "▶ Run" || t === "Run Code";
        }) || buttons.find((b) => (b.innerText || b.textContent || "").trim().toLowerCase().startsWith("run"));
        if (runBtn) {
          runBtn.click();
          return true;
        }
        return false;
      }
    });
    return results.some((frame) => frame.result === true);
  } catch (e) {
    console.warn("Could not click run:", e);
    return false;
  }
}

// Click the "Submit" button on the CodeChef interface
async function clickSubmitOnPage(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      world: "MAIN",
      func: () => {
        const buttons = Array.from(document.querySelectorAll("button, [role='button'], a"));
        const subBtn = buttons.find((b) => {
          const t = (b.innerText || b.textContent || "").trim();
          return t === "Submit" || t === "Submit Code";
        }) || buttons.find((b) => (b.innerText || b.textContent || "").trim().toLowerCase().startsWith("submit"));
        if (subBtn) {
          subBtn.click();
          return true;
        }
        return false;
      }
    });
    return results.some((frame) => frame.result === true);
  } catch (e) {
    console.warn("Could not click submit:", e);
    return false;
  }
}

// Click the "Next" button on the CodeChef interface
async function clickNextOnPage(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      world: "MAIN",
      func: () => {
        const buttons = Array.from(document.querySelectorAll("button, [role='button'], a"));
        const nextBtn = buttons.find((b) => {
          const t = (b.innerText || b.textContent || "").trim();
          return t === "Next" || t.startsWith("Next ") || t.includes("Next module");
        }) || buttons.find((b) => (b.innerText || b.textContent || "").trim().toLowerCase().includes("next"));
        if (nextBtn) {
          nextBtn.click();
          return true;
        }
        return false;
      }
    });
    return results.some((frame) => frame.result === true);
  } catch (e) {
    console.warn("Could not click next:", e);
    return false;
  }
}

// Extract Problem From Active Chrome Tab
async function extractActiveProblem() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !tab.url || !tab.url.includes("codechef.com")) {
      if (problemTitle) problemTitle.innerText = "Navigate to a CodeChef problem";
      return null;
    }

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_PROBLEM" }, async (response) => {
        if (chrome.runtime.lastError) {
          const _err = chrome.runtime.lastError.message;
          // Auto-inject content script if tab was opened before extension loaded
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["content.js"]
            });
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_PROBLEM" }, (retryResp) => {
                if (chrome.runtime.lastError) { const _ = chrome.runtime.lastError.message; }
                if (retryResp && retryResp.data) {
                  activeProblem = retryResp.data;
                  if (problemTitle) problemTitle.innerText = activeProblem.title;
                  if (problemCode) problemCode.innerText = activeProblem.problem_code;
                  if (langBadge) langBadge.innerText = `${activeProblem.language.toUpperCase()} (${activeProblem.active_file})`;
                  resolve(activeProblem);
                  return;
                }
                resolve(null);
              });
            }, 300);
            return;
          } catch (_) {
            resolve(null);
            return;
          }
        }

        if (!response || !response.data) {
          resolve(null);
          return;
        }

        activeProblem = response.data;
        if (problemTitle) problemTitle.innerText = activeProblem.title;
        if (problemCode) problemCode.innerText = activeProblem.problem_code;
        if (langBadge) langBadge.innerText = `${activeProblem.language.toUpperCase()} (${activeProblem.active_file})`;
        resolve(activeProblem);
      });
    });
  } catch (err) {
    return null;
  }
}

// ---------------- FAST AUTO-PILOT EXECUTION ---------------- //
async function courseStatus(tabId) {
  return new Promise((resolve) => chrome.tabs.sendMessage(tabId, { action: "GET_COURSE_STATUS" },
    (response) => resolve(chrome.runtime.lastError ? null : response?.data)));
}

async function waitForCoursePass(tabId, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const status = await courseStatus(tabId);
    if (status?.codeResult?.status === "passed") return true;
    if (status?.codeResult?.status === "failed") return false;
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  return false;
}

async function runAutoPilot(mode = "run") {
  if (isRunningAutoPilot) return;
  isRunningAutoPilot = true;
  btnAutoSolveRun.disabled = true;
  btnAutoSolveSubmit.disabled = true;
  autoPilotStatus.innerText = "Scanning...";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url?.includes("codechef.com")) throw new Error("Open a CodeChef problem first");
    const problem = await extractActiveProblem();
    const editorCode = await getEditorCode(tab.id);
    if (!problem) throw new Error("Problem statement unavailable");
    autoPilotStatus.innerText = "Generating code...";
    let generated = "";
    let generationError = "";
    try {
      const response = await fetch(`${BACKEND_URL}/api/assistant/auto-solve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem_statement: problem.statement,
          extracted_code: problem.extracted_code, editor_code: editorCode,
          language: problem.language, title: problem.title, user_confirmed_allowed: true })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || `Backend HTTP ${response.status}`);
      }
      const data = await response.json();
      generated = data.generated_code || data.code || "";
    } catch (error) { generationError = error.message; }

    let injected = false;
    if (generated && generated.trim() !== editorCode.trim()) {
      autoPilotStatus.innerText = "Injecting code...";
      const injection = await injectCodeToPage(tab.id, generated);
      injected = injection.success;
      if (!injected && !editorCode.trim()) throw new Error(injection.error || "Editor injection unavailable");
    }
    if (!generated && !editorCode.trim()) throw new Error(generationError || "No code available");
    if (mode === "run") {
      if (!(await clickRunOnPage(tab.id))) throw new Error("Run button unavailable");
      autoPilotStatus.innerText = injected ? "Run clicked; check output" : "Existing code run; check output";
      renderContent('<div style="padding:10px">Run clicked. Submit and verify the site tests before advancing.</div>');
      return;
    }
    if (!(await clickSubmitOnPage(tab.id))) throw new Error("Submit button unavailable");
    autoPilotStatus.innerText = "Checking site tests...";
    if (!(await waitForCoursePass(tab.id))) {
      throw new Error(injected ? "Tests did not all pass" :
        (generationError || "Existing code did not pass; editor injection unavailable"));
    }
    autoPilotStatus.innerText = "All site tests passed";
    renderContent('<div style="padding:10px;color:#34d399">All site tests passed.</div>');
    if (chkAutoNext.checked) {
      const oldUrl = tab.url;
      if (!(await clickNextOnPage(tab.id))) throw new Error("Next button unavailable");
      for (let attempt = 0; attempt < 20; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const current = await chrome.tabs.get(tab.id);
        if (current.url !== oldUrl) {
          setTimeout(() => runAutoPilot(mode), 1200);
          return;
        }
      }
      throw new Error("Next did not navigate");
    }
  } catch (error) {
    autoPilotStatus.innerText = "Paused: " + error.message;
    autoPilotStatus.style.color = "#ef4444";
    renderContent('<div style="color:var(--danger);padding:10px">' +
      String(error.message).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])) + '</div>');
  } finally {
    isRunningAutoPilot = false;
    btnAutoSolveRun.disabled = false;
    btnAutoSolveSubmit.disabled = false;
  }
}

btnAutoSolveRun.addEventListener("click", () => runAutoPilot("run"));
btnAutoSolveSubmit.addEventListener("click", () => runAutoPilot("submit"));

// Next Button
btnNext.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    await clickNextOnPage(tab.id);
    setTimeout(() => {
      extractActiveProblem();
    }, 1200);
  }
});

// Sync / Refresh Button
btnSync.addEventListener("click", async () => {
  showLoading("Refreshing task details...");
  await extractActiveProblem();
  renderContent(`<div style="padding: 4px; color: #34d399;">Active problem refreshed: <strong>${activeProblem ? activeProblem.title : 'None'}</strong></div>`);
});

// Explain
btnExplain.addEventListener("click", async () => {
  if (!activeProblem) await extractActiveProblem();
  if (!activeProblem) return alert("Please open a problem tab first.");
  showLoading("Explaining task...");
  try {
    const res = await fetch(`${BACKEND_URL}/api/assistant/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statement: activeProblem.statement })
    });
    const data = await res.json();
    renderContent(`<h4 style="color: #60a5fa; margin-bottom: 6px;">Explanation</h4><div style="font-size: 12px; line-height: 1.6;">${data.message || data.explanation || JSON.stringify(data)}</div>`);
  } catch (e) {
    renderContent(`<div style="color: var(--danger);">Error: ${e.message}</div>`);
  }
});

// Hints
btnHints.addEventListener("click", async () => {
  if (!activeProblem) await extractActiveProblem();
  if (!activeProblem) return alert("Please open a problem tab first.");
  showLoading("Fetching hints...");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const code = tab ? await getEditorCode(tab.id) : "";
    const res = await fetch(`${BACKEND_URL}/api/assistant/hint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_code: code, hint_level: 1 })
    });
    const data = await res.json();
    renderContent(`<div class="hint-card"><div class="hint-level">Hint</div><p style="font-size: 12px;">${data.message}</p></div>`);
  } catch (e) {
    renderContent(`<div style="color: var(--danger);">Error: ${e.message}</div>`);
  }
});

// Approach
btnApproach.addEventListener("click", async () => {
  if (!activeProblem) await extractActiveProblem();
  if (!activeProblem) return alert("Please open a problem tab first.");
  showLoading("Analyzing approach...");
  try {
    const res = await fetch(`${BACKEND_URL}/api/assistant/approach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problem_id: 1 })
    });
    const data = await res.json();
    renderContent(`<h4 style="color: #60a5fa; margin-bottom: 6px;">Approach</h4><div style="font-size: 12px; line-height: 1.6;">${data.message}</div>`);
  } catch (e) {
    renderContent(`<div style="color: var(--danger);">Error: ${e.message}</div>`);
  }
});

// Review
btnReview.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const code = tab ? await getEditorCode(tab.id) : "";
  if (!code) {
    renderContent(`<div class="hint-card"><p>No code detected in editor.</p></div>`);
    return;
  }
  showLoading("Reviewing code...");
  try {
    const res = await fetch(`${BACKEND_URL}/api/assistant/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_code: code, language: activeProblem ? activeProblem.language : "python" })
    });
    const data = await res.json();
    renderContent(`<h4 style="color: #60a5fa; margin-bottom: 6px;">Review</h4><div style="font-size: 12px; line-height: 1.6;">${data.message}</div>`);
  } catch (e) {
    renderContent(`<div style="color: var(--danger);">Error: ${e.message}</div>`);
  }
});

// Speedrunner toggle in Sidepanel
const btnSpeedrunner = document.getElementById("btnSpeedrunner");
const speedrunnerLabel = document.getElementById("speedrunnerLabel");
const speedrunnerIcon = document.getElementById("speedrunnerIcon");
let isSpeedrunning = false;

if (btnSpeedrunner) {
  btnSpeedrunner.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    isSpeedrunning = !isSpeedrunning;
    if (isSpeedrunning) {
      btnSpeedrunner.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
      speedrunnerLabel.innerText = "Auto-Pilot ACTIVE (Hands-Free)";
      speedrunnerIcon.innerText = "⚡";
    } else {
      btnSpeedrunner.style.background = "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)";
      speedrunnerLabel.innerText = "Start Hands-Free Auto-Pilot (All Questions)";
      speedrunnerIcon.innerText = "🚀";
    }

    chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_SPEEDRUNNER", active: isSpeedrunning }, () => {
      if (chrome.runtime.lastError) {
        const _ = chrome.runtime.lastError.message;
      }
    });
  });
}

// Listen for page navigation
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "PAGE_NAVIGATED") {
    setTimeout(() => {
      extractActiveProblem();
    }, 1200);
  }
});

// Initialize on load
checkBackendHealth();
setInterval(checkBackendHealth, 5000);
extractActiveProblem();
