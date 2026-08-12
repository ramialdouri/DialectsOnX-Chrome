/**
 * DialectsOnX IME: translate swaps text in focused website textboxes.
 * Uses Dialex dialect sheet (not a soft keyboard). Full Pad: dialex-app.com/#pad
 */
(function () {
  const catalog = globalThis.DialexCatalog;
  const sheetApi = globalThis.DialexSheet;
  const sttApi = globalThis.DialexStt;
  if (!catalog) return;

  const DEFAULT_BACKEND_URL =
    "https://dialex-backend-f6b7-1086119311146.europe-west3.run.app";
  const DIALEX_PAD_URL = "https://dialex-app.com/#pad";
  const DEFAULT_DIALECT = catalog.DEFAULT_DIALECT;
  const DEFAULT_LANGUAGE = catalog.DEFAULT_LANGUAGE;

  let preferredDialect = DEFAULT_DIALECT;
  let preferredLanguage = DEFAULT_LANGUAGE;
  let barEl = null;
  let activeTarget = null;
  let originals = new WeakMap();
  let busy = false;
  let holdBar = false;
  let stopping = false;
  let mediaRecorder = null;
  let recordChunks = [];
  let recordTarget = null;
  let recordTimer = null;
  const RECORD_MAX_MS = 60000;
  const MIC_SVG =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Z" stroke="currentColor" stroke-width="1.8"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  function loadSettings() {
    chrome.storage.sync.get(
      {
        preferredDialect: DEFAULT_DIALECT,
        preferredLanguage: DEFAULT_LANGUAGE
      },
      (data) => {
        preferredDialect =
          catalog.normalizeDialectId(data.preferredDialect) || DEFAULT_DIALECT;
        preferredLanguage =
          catalog.resolveLanguageId(data.preferredLanguage) ||
          catalog.dialectById(preferredDialect)?.languageId ||
          DEFAULT_LANGUAGE;
        refreshBarLabels();
      }
    );
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes.preferredDialect?.newValue) {
      preferredDialect =
        catalog.normalizeDialectId(changes.preferredDialect.newValue) ||
        preferredDialect;
    }
    if (changes.preferredLanguage?.newValue) {
      preferredLanguage =
        catalog.resolveLanguageId(changes.preferredLanguage.newValue) ||
        preferredLanguage;
    }
    refreshBarLabels();
  });

  function isEditable(el) {
    if (!el || el.disabled || el.readOnly) return false;
    if (el instanceof HTMLTextAreaElement) return true;
    if (el instanceof HTMLInputElement) {
      const type = (el.type || "text").toLowerCase();
      return ["text", "search", "email", "url", "tel", "", "password"].includes(type);
    }
    return Boolean(el.isContentEditable);
  }

  function canDictate(el) {
    if (!isEditable(el)) return false;
    if (el instanceof HTMLInputElement && (el.type || "").toLowerCase() === "password") {
      return false;
    }
    return true;
  }

  function readValue(el) {
    if (el.isContentEditable) return el.innerText || "";
    return el.value || "";
  }

  function writeValue(el, value) {
    if (el.isContentEditable) {
      el.focus();
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, value);
      if (readValue(el) !== value) el.textContent = value;
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
      return;
    }
    el.focus();
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function insertValue(el, text) {
    if (!el || !text) return;
    if (el.isContentEditable) {
      el.focus();
      const ok = document.execCommand("insertText", false, text);
      if (!ok) {
        const cur = readValue(el);
        writeValue(el, cur ? `${cur.replace(/\s+$/, "")} ${text}` : text);
      } else {
        el.dispatchEvent(new InputEvent("input", { bubbles: true }));
      }
      return;
    }
    el.focus();
    const start = el.selectionStart ?? (el.value || "").length;
    const end = el.selectionEnd ?? (el.value || "").length;
    const next = `${(el.value || "").slice(0, start)}${text}${(el.value || "").slice(end)}`;
    writeValue(el, next);
    const pos = start + text.length;
    try {
      el.setSelectionRange(pos, pos);
    } catch (_) {}
  }

  function injectStyles() {
    if (document.getElementById("dialx-ime-styles")) return;
    const style = document.createElement("style");
    style.id = "dialx-ime-styles";
    style.textContent = `
      #dialx-ime-bar {
        position: fixed;
        z-index: 2147483646;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
        padding: 8px 10px;
        border-radius: 12px;
        background: #0a0a0b;
        border: 1px solid #1e1e22;
        box-shadow: 0 10px 30px rgba(0,0,0,0.45);
        font-family: Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 12px;
        color: #f2f4f7;
      }
      #dialx-ime-bar button, #dialx-ime-bar a {
        border-radius: 999px;
        border: 1px solid #1e1e22;
        background: #141417;
        color: #f2f4f7;
        padding: 5px 10px;
        font: inherit;
        cursor: pointer;
        text-decoration: none;
      }
      #dialx-ime-bar button.primary {
        background: #f2f4f7;
        border-color: #f2f4f7;
        color: #000;
        font-weight: 700;
      }
      #dialx-ime-bar button:disabled { opacity: 0.55; cursor: default; }
      #dialx-ime-bar .status { color: #9ba3ae; }
      #dialx-ime-bar .status.error { color: #cf6b6b; }
      #dialx-ime-dialect {
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        border-top: 1px solid #d1d7de;
        border-bottom: 1px dashed #d1d7de;
        background: #141417;
      }
      #dialx-ime-bar button.ime-mic {
        padding: 5px 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
      }
      #dialx-ime-bar button.ime-mic svg { display: block; }
      #dialx-ime-bar button.ime-mic.recording {
        border-color: #cf6b6b;
        color: #cf6b6b;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function ensureBar() {
    if (barEl) return barEl;
    injectStyles();
    barEl = document.createElement("div");
    barEl.id = "dialx-ime-bar";
    barEl.innerHTML = `
      <button type="button" id="dialx-ime-dialect"></button>
      <button type="button" class="ime-mic" id="dialx-ime-mic" aria-label="Voice input" title="Voice input">${MIC_SVG}</button>
      <button type="button" class="primary" id="dialx-ime-translate">Translate</button>
      <button type="button" id="dialx-ime-toggle" hidden>Original</button>
      <a id="dialx-ime-pad" href="${DIALEX_PAD_URL}" target="_blank" rel="noopener noreferrer">Open Dialex Pad</a>
      <span class="status" id="dialx-ime-status"></span>
    `;
    document.documentElement.appendChild(barEl);

    barEl.querySelector("#dialx-ime-dialect").addEventListener("mousedown", (e) => {
      e.preventDefault();
    });
    barEl.querySelector("#dialx-ime-dialect").addEventListener("click", (e) => {
      e.preventDefault();
      openSheet();
    });
    barEl.querySelector("#dialx-ime-mic").addEventListener("mousedown", (e) => {
      e.preventDefault();
    });
    barEl.querySelector("#dialx-ime-mic").addEventListener("click", (e) => {
      e.preventDefault();
      toggleMic();
    });
    barEl.querySelector("#dialx-ime-translate").addEventListener("mousedown", (e) => {
      e.preventDefault();
    });
    barEl.querySelector("#dialx-ime-translate").addEventListener("click", (e) => {
      e.preventDefault();
      runTranslate();
    });
    barEl.querySelector("#dialx-ime-toggle").addEventListener("mousedown", (e) => {
      e.preventDefault();
    });
    barEl.querySelector("#dialx-ime-toggle").addEventListener("click", (e) => {
      e.preventDefault();
      toggleOriginal();
    });

    return barEl;
  }

  function refreshBarLabels() {
    if (!barEl) return;
    barEl.querySelector("#dialx-ime-dialect").textContent =
      catalog.summaryLabel(preferredDialect);
  }

  function openSheet() {
    if (!sheetApi) return;
    sheetApi.openDialectSheet({
      languageId: preferredLanguage,
      dialectId: preferredDialect,
      onSelect: ({ languageId, dialectId }) => {
        preferredLanguage = languageId;
        preferredDialect = dialectId;
        chrome.storage.sync.set({ preferredLanguage, preferredDialect });
        refreshBarLabels();
      }
    });
  }

  function positionBar(target) {
    const bar = ensureBar();
    refreshBarLabels();
    const rect = target.getBoundingClientRect();
    const top = Math.min(window.innerHeight - 56, Math.max(8, rect.bottom + 8));
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - (bar.offsetWidth || 380) - 8));
    bar.style.top = `${top}px`;
    bar.style.left = `${left}px`;
    bar.hidden = false;
  }

  function hideBar() {
    if (holdBar) return;
    if (barEl) barEl.hidden = true;
  }

  function setBarBusy(on) {
    if (!barEl) return;
    barEl.querySelector("#dialx-ime-mic").disabled = on;
    barEl.querySelector("#dialx-ime-translate").disabled = on;
  }

  function setRecordingUi(on) {
    if (!barEl) return;
    const mic = barEl.querySelector("#dialx-ime-mic");
    mic.classList.toggle("recording", on);
    mic.setAttribute("aria-label", on ? "Stop recording" : "Voice input");
    mic.setAttribute("title", on ? "Stop recording" : "Voice input");
    barEl.querySelector("#dialx-ime-translate").disabled = on;
  }

  function setStatus(msg, isError) {
    if (!barEl) return;
    const el = barEl.querySelector("#dialx-ime-status");
    el.textContent = msg || "";
    el.classList.toggle("error", Boolean(isError));
  }

  async function runTranslate() {
    const target = activeTarget;
    if (!target || !isEditable(target) || busy) return;
    const text = readValue(target).trim();
    if (!text) {
      setStatus("No text to translate.", true);
      return;
    }
    busy = true;
    setBarBusy(true);
    setStatus("Translating...");
    try {
      if (!originals.has(target)) originals.set(target, readValue(target));
      const res = await fetch(`${DEFAULT_BACKEND_URL}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          target_dialect: preferredDialect,
          source_language: "auto",
          client_source: "ime"
        })
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const err = await res.json();
          detail = err.detail?.detail || err.detail || err.error || detail;
          if (typeof detail !== "string") detail = JSON.stringify(detail);
        } catch {}
        throw new Error(detail);
      }
      const data = await res.json();
      writeValue(target, data.translation || text);
      barEl.querySelector("#dialx-ime-toggle").hidden = false;
      setStatus("Done");
    } catch (err) {
      setStatus(err.message || "Failed", true);
    } finally {
      busy = false;
      setBarBusy(false);
    }
  }

  function toggleOriginal() {
    const target = activeTarget;
    if (!target || !originals.has(target)) return;
    writeValue(target, originals.get(target));
    setStatus("Restored original");
  }

  function clearRecordTimer() {
    if (recordTimer) {
      clearTimeout(recordTimer);
      recordTimer = null;
    }
  }

  async function toggleMic() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      stopping = true;
      mediaRecorder.stop();
      return;
    }
    if (busy || stopping) return;
    const target = activeTarget;
    if (!target || !canDictate(target)) {
      setStatus("Focus a text field first.", true);
      return;
    }
    if (!sttApi) {
      setStatus("Transcription failed.", true);
      return;
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setStatus("Microphone needs a secure (https) page.", true);
      return;
    }
    holdBar = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = sttApi.recorderMime();
      recordChunks = [];
      recordTarget = target;
      mediaRecorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      const usedMime = mediaRecorder.mimeType || mime || "audio/webm";
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size) recordChunks.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        clearRecordTimer();
        stopping = false;
        stream.getTracks().forEach((t) => t.stop());
        setRecordingUi(false);
        mediaRecorder = null;
        const blob = new Blob(recordChunks, { type: usedMime });
        recordChunks = [];
        const field = recordTarget;
        recordTarget = null;
        if (!blob.size) {
          holdBar = false;
          setStatus("No audio captured.", true);
          return;
        }
        busy = true;
        setBarBusy(true);
        setStatus("Transcribing...");
        try {
          const result = await sttApi.transcribe({
            backendUrl: DEFAULT_BACKEND_URL,
            blob,
          });
          if (field && isEditable(field)) {
            if (!originals.has(field)) originals.set(field, readValue(field));
            insertValue(field, result.text);
            barEl.querySelector("#dialx-ime-toggle").hidden = false;
            activeTarget = field;
            try {
              field.focus();
            } catch (_) {}
            positionBar(field);
          }
          setStatus("Done");
        } catch (err) {
          setStatus(err.message || "Transcription failed.", true);
        } finally {
          busy = false;
          holdBar = false;
          setBarBusy(false);
        }
      };
      mediaRecorder.start(250);
      setRecordingUi(true);
      setStatus("Recording. Tap the microphone to stop.");
      recordTimer = setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
          stopping = true;
          mediaRecorder.stop();
        }
      }, RECORD_MAX_MS);
    } catch {
      holdBar = false;
      stopping = false;
      setRecordingUi(false);
      setStatus("Microphone permission was denied.", true);
    }
  }

  function onFocusIn(e) {
    const t = e.target;
    if (!isEditable(t)) return;
    activeTarget = t;
    ensureBar();
    positionBar(t);
    if (!holdBar) setStatus("");
  }

  function onFocusOut() {
    setTimeout(() => {
      if (holdBar) return;
      const active = document.activeElement;
      if (barEl && (barEl === active || barEl.contains(active))) return;
      if (document.getElementById("dx-sheet-root")) return;
      if (active && isEditable(active)) {
        activeTarget = active;
        positionBar(active);
        return;
      }
      hideBar();
    }, 0);
  }

  loadSettings();
  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("focusout", onFocusOut, true);
  window.addEventListener("scroll", () => {
    if (activeTarget && document.activeElement === activeTarget) positionBar(activeTarget);
  }, true);
  window.addEventListener("resize", () => {
    if (activeTarget && document.activeElement === activeTarget) positionBar(activeTarget);
  });
})();
