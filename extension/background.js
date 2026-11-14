// CodeChef Copilot — Background Service Worker

// Open side panel when the toolbar action icon is clicked
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
});

// Master clean code injection across all frames (Monaco / VS Code Web / Ace / Textarea)
async function executeCleanInjection(tabId, solutionCode) {
  if (!tabId || !solutionCode) return false;
  try {
    const runScriptSafely = async (scriptFunc, scriptArgs) => {
      try {
        return await chrome.scripting.executeScript({
          target: { tabId: tabId, allFrames: true },
          world: "MAIN",
          func: scriptFunc,
          args: scriptArgs
        });
      } catch (_) {
        try {
          return await chrome.scripting.executeScript({
            target: { tabId: tabId },
            world: "MAIN",
            func: scriptFunc,
            args: scriptArgs
          });
        } catch (e2) { throw e2; }
      }
    };

    const results = await runScriptSafely(async (codeToInject) => {
      let replaced = false;

      // -------------------------------------------------------------
      // TIER 1: Monaco Editor API & Window Model Registry
      // -------------------------------------------------------------
      try {
        if (window.monaco && window.monaco.editor) {
          if (typeof window.monaco.editor.getModels === "function") {
            const models = window.monaco.editor.getModels();
            if (models && models.length > 0) {
              const target = models.find(m => {
                const p = (m.uri ? m.uri.path : "").toLowerCase();
                return p.endsWith(".py") || p.endsWith(".cpp") || p.includes("workspace") || p.includes("main");
              }) || models[0];
              target.setValue(codeToInject);
              replaced = true;
            }
          }
          if (!replaced && typeof window.monaco.editor.getEditors === "function") {
            const editors = window.monaco.editor.getEditors();
            for (const ed of editors) {
              try {
                ed.setValue(codeToInject);
                replaced = true;
              } catch (_) {}
            }
          }
        }
      } catch (_) {}

      // -------------------------------------------------------------
      // TIER 2: Deep Window Scan for getModels() or setValue()
      // -------------------------------------------------------------
      if (!replaced) {
        try {
          const candidateKeys = Object.keys(window).filter(k => 
            !k.startsWith("webkit") && !k.startsWith("on") && k !== "window" && k !== "document" && k !== "top"
          );
          for (const k of candidateKeys) {
            try {
              const o = window[k];
              if (!o || typeof o !== "object") continue;
              if (typeof o.getModels === "function") {
                const ms = o.getModels();
                if (ms && ms.length > 0) {
                  const target = ms.find(m => {
                    const p = (m.uri ? m.uri.path : "").toLowerCase();
                    return p.endsWith(".py") || p.endsWith(".cpp") || p.includes("workspace") || p.includes("main");
                  }) || ms[0];
                  target.setValue(codeToInject);
                  replaced = true;
                  break;
                }
              }
              if (typeof o.setValue === "function" && typeof o.getValue === "function") {
                o.setValue(codeToInject);
                replaced = true;
                break;
              }
            } catch (_) {}
          }
        } catch (_) {}
      }

      // -------------------------------------------------------------
      // TIER 3: VS Code Web AMD Loader (vscode-loader & RequireJS cache)
      // -------------------------------------------------------------
      if (!replaced && typeof window.require === "function") {
        try {
          const defined = window.require.s && window.require.s.contexts && window.require.s.contexts._ && window.require.s.contexts._.defined;
          if (defined) {
            for (const mod of Object.values(defined)) {
              if (!mod) continue;
              if (typeof mod.getModels === "function") {
                const ms = mod.getModels();
                if (ms && ms.length > 0) {
                  ms[0].setValue(codeToInject);
                  replaced = true;
                  break;
                }
              }
              if (typeof mod.getCodeEditors === "function") {
                const eds = mod.getCodeEditors();
                if (eds && eds.length > 0) {
                  eds[0].setValue(codeToInject);
                  replaced = true;
                  break;
                }
              }
            }
          }
          if (!replaced) {
            const modMap = window.require._modules || (window.define && window.define.Loader && window.define.Loader._modules);
            if (modMap) {
              const entries = modMap instanceof Map ? Array.from(modMap.values()) : Object.values(modMap);
              for (const entry of entries) {
                const exp = entry && entry.exports ? entry.exports : entry;
                if (!exp) continue;
                if (typeof exp.getModels === "function") {
                  const ms = exp.getModels();
                  if (ms && ms.length > 0) {
                    ms[0].setValue(codeToInject);
                    replaced = true;
                    break;
                  }
                }
              }
            }
          }
        } catch (_) {}
      }

      // -------------------------------------------------------------
      // TIER 4: DOM Element Property & React Fiber Inspection
      // -------------------------------------------------------------
      if (!replaced) {
        try {
          const editorNodes = document.querySelectorAll(".monaco-editor, .monaco-workbench, [data-keybinding-context]");
          for (const el of editorNodes) {
            for (const prop of Object.getOwnPropertyNames(el)) {
              try {
                const val = el[prop];
                if (val && typeof val === "object") {
                  if (typeof val.setValue === "function") { val.setValue(codeToInject); replaced = true; break; }
                  if (typeof val.getModel === "function" && val.getModel()) { val.getModel().setValue(codeToInject); replaced = true; break; }
                  if (val.editor && typeof val.editor.setValue === "function") { val.editor.setValue(codeToInject); replaced = true; break; }
                }
              } catch (_) {}
            }
            if (replaced) break;
          }
        } catch (_) {}
      }

      // -------------------------------------------------------------
      // TIER 5: Monaco & Native Textarea Select-All & Insert
      // -------------------------------------------------------------
      if (!replaced) {
        const ta = document.querySelector(".monaco-editor textarea, textarea.inputarea, textarea");
        if (ta) {
          ta.focus();
          const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);

          // Step 1: Dispatch Native Keydown for Select All (Ctrl+A / Cmd+A) to ta AND window
          const selectAllEvent = new KeyboardEvent("keydown", {
            key: "a", code: "KeyA", keyCode: 65, which: 65,
            ctrlKey: !isMac, metaKey: isMac,
            bubbles: true, cancelable: true, composed: true, view: window
          });
          ta.dispatchEvent(selectAllEvent);
          window.dispatchEvent(selectAllEvent);

          // Step 2: Also dispatch Ctrl+Home then Ctrl+Shift+End (Selects full document in all editors)
          ta.dispatchEvent(new KeyboardEvent("keydown", {
            key: "Home", code: "Home", keyCode: 36, which: 36,
            ctrlKey: !isMac, metaKey: isMac, bubbles: true, cancelable: true, view: window
          }));
          ta.dispatchEvent(new KeyboardEvent("keydown", {
            key: "End", code: "End", keyCode: 35, which: 35,
            ctrlKey: !isMac, metaKey: isMac, shiftKey: true, bubbles: true, cancelable: true, view: window
          }));

          // Step 3: Yield so Monaco updates selection buffer
          await new Promise(r => setTimeout(r, 60));

          // Step 4: Execute replace via document.execCommand
          document.execCommand("insertText", false, codeToInject);

          // Step 5: Save file via Ctrl+S
          ta.dispatchEvent(new KeyboardEvent("keydown", {
            key: "s", code: "KeyS", keyCode: 83, which: 83,
            ctrlKey: !isMac, metaKey: isMac,
            bubbles: true, cancelable: true, composed: true, view: window
          }));

          replaced = true;
        }
      }

      return replaced;
    }, [solutionCode]);

    return results && results.length > 0 ? results.some((frame) => frame.result === true) : true;
  } catch (err) {
    console.warn("[CodeChef Copilot] Scripting injection notice:", err);
    return false;
  }
}

// Proxy backend API requests from content scripts and execute clean injection across all frames
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id ||
    (message.action === "INJECT_CODE" && Number.isInteger(message.tabId) ? message.tabId : null);

  if (message.action === "GET_ASSISTANT_STATUS") {
    fetch("http://127.0.0.1:8000/api/assistant/status")
      .then((res) => {
        if (!res.ok) throw new Error(`Backend status HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => sendResponse({ status: "ok", data }))
      .catch(() => sendResponse({ status: "error", error: "Backend offline or needs restart" }));
    return true;
  }

  if (message.action === "CALL_AUTO_SOLVE") {
    fetch("http://127.0.0.1:8000/api/assistant/auto-solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload)
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(async (data) => {
        const solutionCode = data.generated_code || data.code;

        if (tabId && solutionCode) {
          const injected = await executeCleanInjection(tabId, solutionCode);

          sendResponse({ status: "ok", injected, data: { generated_code: solutionCode } });
          return;
        }
        sendResponse({ status: "error", error: "No generated code or active tab" });
      })
      .catch((err) => {
        console.warn("[CodeChef Copilot] Backend request warning:", err.message);
        sendResponse({ status: "error", error: err.message === "Failed to fetch" ? "Backend unreachable; start or restart the local server" : err.message });
      });
    return true; // Keep message channel open for async response
  }

  if (message.action === "CALL_AUTO_HEAL") {
    fetch("http://127.0.0.1:8000/api/assistant/auto-heal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload)
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(async (data) => {
        const fixedCode = data.fixed_code;
        if (tabId && fixedCode) {
          const injected = await executeCleanInjection(tabId, fixedCode);
          sendResponse({ status: "ok", injected, data });
          return;
        }
        sendResponse({ status: "error", error: "No fixed code or active tab" });
      })
      .catch((err) => {
        console.warn("[CodeChef Copilot] Auto-heal notice:", err.message);
        sendResponse({ status: "error", error: err.message });
      });
    return true;
  }

  if (message.action === "CALL_SOLVE_MCQ") {
    fetch("http://127.0.0.1:8000/api/assistant/solve-mcq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload)
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        sendResponse({ status: "ok", data });
      })
      .catch((err) => {
        console.info("[CodeChef Copilot] MCQ solve notice:", err.message);
        sendResponse({ status: "error", error: err.message === "Failed to fetch" ? "Backend unreachable; start or restart the local server" : err.message });
      });
    return true;
  }

  if (message.action === "INJECT_CODE") {
    if (tabId && message.code) {
      executeCleanInjection(tabId, message.code)
        .then((res) => sendResponse({ status: "ok", replaced: res }))
        .catch((err) => sendResponse({ status: "error", error: err.message }));
      return true;
    }
  }

  if (message.action === "PING") {
    sendResponse({ status: "pong", version: "1.0.5" });
    return true;
  }

  sendResponse({ status: "received" });
  return true;
});
