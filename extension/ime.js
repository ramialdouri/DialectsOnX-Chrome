/* Floating DialectsOnX IME bar — all sites, not an OS keyboard. */
globalThis.Dox = globalThis.Dox || {};

(function () {
  if (window.__doxImeInit) return;
  window.__doxImeInit = true;
  if (location.protocol === "chrome-extension:") return;
  try {
    if (window.top !== window) return;
  } catch {
    return;
  }

  const STT_CODES = {
    arabic: "ar",
    czech: "cs",
    danish: "da",
    dutch: "nl",
    english: "en",
    filipino: "fil",
    french: "fr",
    german: "de",
    hindi: "hi",
    indonesian: "id",
    italian: "it",
    japanese: "ja",
    korean: "ko",
    macedonian: "mk",
    malay: "ms",
    persian: "fa",
    polish: "pl",
    portuguese: "pt",
    romanian: "ro",
    russian: "ru",
    spanish: "es",
    swedish: "sv",
    thai: "th",
    turkish: "tr",
    vietnamese: "vi",
  };

  function sttLanguage(systemDialectId) {
    const spoken = Dox.spokenIdOf(systemDialectId);
    return STT_CODES[spoken] || "en";
  }

  let bar = null;
  let dragging = false;
  let dragDx = 0;
  let dragDy = 0;
  let inflight = null;
  let statusEl = null;
  let lastField = null;

  function t(k, ...a) {
    return Dox.locale.t(k, ...a);
  }

  let freezePlace = false;
  const AREA_INSET = 56;

  function skipField(el) {
    if (!el) return true;
    const type = (el.getAttribute("type") || "").toLowerCase();
    if (type === "password" || type === "email" || type === "url") return true;
    const mode = (el.getAttribute("inputmode") || "").toLowerCase();
    if (mode === "url" || mode === "email") return true;
    const ac = (el.getAttribute("autocomplete") || "").toLowerCase();
    if (ac.includes("url") || ac.includes("email") || ac.includes("password")) return true;
    if (el.closest("[data-dox-ime-bar], .dox-sheet-scrim, .dox-sheet")) return true;
    return false;
  }

  function focusedInput() {
    const el = document.activeElement;
    if (el && !skipField(el) && (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
      lastField = el;
      return el;
    }
    if (lastField?.isConnected && !skipField(lastField)) return lastField;
    return null;
  }

  function editorRoot(el) {
    if (!el) return null;
    const box =
      el.closest('[data-testid^="tweetTextarea"]') ||
      el.closest('[role="textbox"][contenteditable="true"]') ||
      el;
    if (box.getAttribute && box.getAttribute("contenteditable") === "true") return box;
    return (box.querySelector && box.querySelector('[contenteditable="true"]')) || el;
  }

  function readValue(el) {
    const field = editorRoot(el) || el;
    if (field.isContentEditable) return field.innerText || field.textContent || "";
    return field.value || "";
  }

  function writeValue(el, text) {
    const field = editorRoot(el) || el;
    if (field.isContentEditable) {
      field.focus();
      const sel = window.getSelection();
      try {
        const range = document.createRange();
        range.selectNodeContents(field);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (_) {
        /* keep going */
      }
      const ok = document.execCommand("insertText", false, text);
      if (!ok) {
        field.textContent = text;
        field.dispatchEvent(
          new InputEvent("input", { bubbles: true, inputType: "insertText", data: text })
        );
      }
      return;
    }
    const proto = field.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    desc?.set?.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function injectImeStyles() {
    if (document.getElementById("dox-ime-styles")) return;
    const style = document.createElement("style");
    style.id = "dox-ime-styles";
    style.textContent = `
      #dialx-ime-bar {
        position: fixed; z-index: 2147482500;
        display: flex; align-items: center; gap: 6px;
        background: var(--dox-elevated, #0E0E10); color: var(--dox-text, #F4F4F5);
        border: 1px solid var(--dox-line, #2C2C31);
        border-radius: 12px; padding: 10px 12px;
        padding-inline-end: 36px;
        font-family: var(--dox-font, ${Dox.FONT}); font-size: 13px;
        box-shadow: 0 8px 24px rgba(0,0,0,.4);
        user-select: none;
      }
      #dialx-ime-bar button, #dialx-ime-bar .dox-ime-chip {
        font: inherit; border-radius: 999px; cursor: pointer;
        background: var(--dox-field, #1C1C1F); color: var(--dox-text, #F4F4F5);
        border: 1px solid var(--dox-line, #2C2C31);
        padding: 5px 10px;
      }
      #dialx-ime-bar .dox-ime-go {
        background: transparent;
        border-color: var(--dox-accent);
      }
      #dialx-ime-bar .dox-ime-x {
        position: absolute; top: 0; inset-inline-end: 0;
        width: 44px; height: 44px;
        background: transparent; border: 0; color: var(--dox-muted, #8E8E93);
        padding: 0;
        display: inline-flex; align-items: center; justify-content: center;
      }
      #dialx-ime-bar .dox-ime-x:hover { color: #B4B4B8; }
      #dialx-ime-bar .dox-ime-status {
        color: var(--dox-muted, #8E8E93); font-size: 11px; min-width: 4em;
        margin-inline-start: 2px;
        display: inline-flex; align-items: center;
      }
      #dialx-ime-bar .dox-ime-status.is-busy,
      #dialx-ime-bar .dox-ime-status.dox-status-busy { color: var(--dox-status, #A8B4C0); }
      #dialx-ime-bar .dox-ime-status.is-error,
      #dialx-ime-bar .dox-ime-status.dox-status-error { color: var(--dox-danger, #FF453A); }
      #dialx-ime-bar.dox-ime-drag { cursor: grabbing; }
    `;
    document.documentElement.appendChild(style);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(n, max));
  }

  function fieldVisible(el) {
    if (!el || typeof el.getBoundingClientRect !== "function") return false;
    const r = el.getBoundingClientRect();
    return (
      r.width > 8 &&
      r.height > 8 &&
      r.bottom > 0 &&
      r.right > 0 &&
      r.top < window.innerHeight &&
      r.left < window.innerWidth
    );
  }

  function visibleHostField() {
    const focused = focusedInput();
    if (focused && fieldVisible(focused)) return focused;
    if (lastField?.isConnected && !skipField(lastField) && fieldVisible(lastField)) return lastField;
    let best = null;
    let bestArea = 0;
    for (const el of document.querySelectorAll(
      "input:not([type=hidden]), textarea, [contenteditable='true']"
    )) {
      if (skipField(el) || !fieldVisible(el)) continue;
      const r = el.getBoundingClientRect();
      const area = r.width * r.height;
      if (area > bestArea) {
        best = el;
        bestArea = area;
      }
    }
    return best;
  }

  function placeUnderField(field) {
    if (!bar || freezePlace || dragging) return;
    if (document.querySelector(".dox-sheet-scrim")) return;
    const el = field || focusedInput();
    const barW = bar.offsetWidth || 360;
    const barH = bar.offsetHeight || 52;
    let x;
    let y;
    if (el && typeof el.getBoundingClientRect === "function") {
      const r = el.getBoundingClientRect();
      x = r.left;
      y = r.bottom + 8;
      if (y + barH > window.innerHeight - 8) {
        y = Math.max(8, r.top - barH - 8);
      }
    } else {
      x = window.innerWidth - barW - AREA_INSET;
      y = window.innerHeight - barH - AREA_INSET;
    }
    bar.style.left = clamp(x, 8, window.innerWidth - barW - 8) + "px";
    bar.style.top = clamp(y, 8, window.innerHeight - barH - 8) + "px";
  }

  function placeForShow() {
    freezePlace = false;
    placeUnderField(visibleHostField());
  }

  async function place() {
    placeUnderField();
  }

  function restoreBarPlace(snap) {
    if (!bar || !snap) return;
    if (snap.left) bar.style.left = snap.left;
    if (snap.top) bar.style.top = snap.top;
  }

  function watchSheetClose(snap) {
    const obs = new MutationObserver(() => {
      if (!document.querySelector(".dox-sheet-scrim")) {
        obs.disconnect();
        restoreBarPlace(snap);
        requestAnimationFrame(() => {
          freezePlace = false;
        });
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  async function mount() {
    const prefs = await Dox.prefs.get();
    if (!prefs.extensionEnabled || !prefs.imeEnabled || prefs.imeCollapsed) {
      bar?.remove();
      bar = null;
      return;
    }
    if (bar) {
      await refresh();
      return;
    }
    injectImeStyles();
    await Dox.locale.ready();
    bar = document.createElement("div");
    bar.id = "dialx-ime-bar";
    bar.dataset.doxImeBar = "1";
    Dox.locale.applyDir(bar);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "dox-ime-x";
    close.appendChild(Dox.icon("close", 16));
    close.title = t("dox_ime_collapse");
    close.addEventListener("click", async (e) => {
      e.stopPropagation();
      await Dox.prefs.set({ imeCollapsed: true });
      bar.remove();
      bar = null;
    });
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "dox-ime-chip";
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      const snap = { left: bar.style.left, top: bar.style.top };
      freezePlace = true;
      watchSheetClose(snap);
      Dox.prefs.get().then((p) => {
        Dox.sheet.open({
          mode: "ime",
          selectedId: p.imeDialect,
          onPick: async () => {
            freezePlace = true;
            restoreBarPlace(snap);
            await refresh();
            const host =
              lastField?.isConnected && !skipField(lastField) ? lastField : focusedInput();
            if (host) {
              host.focus();
              lastField = host;
            }
            restoreBarPlace(snap);
            const goBtn = bar?.querySelector(".dox-ime-go");
            if (goBtn) await translateFocused(goBtn);
            restoreBarPlace(snap);
            freezePlace = false;
          },
        });
      });
    });
    statusEl = document.createElement("span");
    statusEl.className = "dox-ime-status";
    const mic = document.createElement("button");
    mic.type = "button";
    mic.className = "dox-ime-mic";
    mic.textContent = t("ime_mic");
    mic.addEventListener("click", (e) => {
      e.stopPropagation();
      startStt();
    });
    const go = document.createElement("button");
    go.type = "button";
    go.className = "dox-ime-go";
    go.textContent = t("ime_translate");
    go.addEventListener("click", (e) => {
      e.stopPropagation();
      if (inflight) {
        inflight.abort();
        inflight = null;
        go.textContent = t("ime_translate");
        return;
      }
      translateFocused(go);
    });
    bar.append(close, chip, statusEl, mic, go);
    bar.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      dragging = true;
      bar.classList.add("dox-ime-drag");
      dragDx = e.clientX - bar.offsetLeft;
      dragDy = e.clientY - bar.offsetTop;
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      bar.style.left = e.clientX - dragDx + "px";
      bar.style.top = e.clientY - dragDy + "px";
    });
    bar.addEventListener("pointerup", () => {
      if (!dragging) return;
      dragging = false;
      bar.classList.remove("dox-ime-drag");
    });
    document.documentElement.appendChild(bar);
    await place();
    await refresh();
  }

  async function refresh() {
    if (!bar) return;
    const prefs = await Dox.prefs.get();
    const chip = bar.querySelector(".dox-ime-chip");
    if (chip) chip.textContent = Dox.locale.chipButtonText(prefs.imeDialect);
    const mic = bar.querySelector(".dox-ime-mic");
    const go = bar.querySelector(".dox-ime-go");
    const close = bar.querySelector(".dox-ime-x");
    if (mic && !inflight) mic.textContent = t("ime_mic");
    if (go && !inflight) go.textContent = t("ime_translate");
    if (close) close.title = t("dox_ime_collapse");
    if (statusEl && !inflight) {
      statusEl.classList.remove("is-busy", "is-error", "dox-status-busy", "dox-status-error");
      statusEl.textContent = t("dox_ime_idle");
    }
    Dox.locale.applyDir(bar);
  }

  async function translateFocused(go) {
    const el = focusedInput();
    if (!el) {
      if (statusEl) statusEl.textContent = t("dox_skip_field");
      return;
    }
    const text = readValue(el).trim();
    if (!text) {
      if (statusEl) statusEl.textContent = t("ime_empty_host");
      return;
    }
    const prefs = await Dox.prefs.get();
    inflight = new AbortController();
    go.textContent = t("ime_translate_cancel");
    if (statusEl) {
      if (typeof Dox.fillBusyStatus === "function") Dox.fillBusyStatus(statusEl, t("status_translating"));
      else statusEl.textContent = t("status_translating");
    }
    try {
      const result = await Dox.api.translate({
        text,
        targetDialect: prefs.imeDialect,
        clientSource: "ime",
        signal: inflight.signal,
      });
      if (!el.isConnected || skipField(el)) {
        if (statusEl) statusEl.textContent = t("ime_host_changed");
        return;
      }
      writeValue(el, result.translation);
      if (statusEl) {
        statusEl.classList.remove("is-busy", "is-error", "dox-status-busy", "dox-status-error");
        statusEl.textContent = t("dox_status_ready");
      }
    } catch (e) {
      if (e && e.name === "AbortError") {
        if (statusEl) {
          statusEl.classList.remove("is-busy", "is-error", "dox-status-busy", "dox-status-error");
          statusEl.textContent = t("dox_ime_idle");
        }
        return;
      }
      if (statusEl) {
        const msg =
          e && e.code === "rate_limited" ? t("dox_rate_limited") : t("dox_translate_failed");
        if (typeof Dox.fillErrorStatus === "function") Dox.fillErrorStatus(statusEl, msg);
        else statusEl.textContent = msg;
      }
    } finally {
      inflight = null;
      go.textContent = t("ime_translate");
    }
  }

  async function startStt() {
    if (statusEl) statusEl.textContent = t("pad_recording");
    try {
      const prefs = await Dox.prefs.get();
      const language = sttLanguage(prefs.systemDialectId);
      const result = await chrome.runtime.sendMessage({
        type: "dox-stt",
        language,
      });
      if (result?.error) throw new Error(result.error);
      if (!result?.wav) throw new Error("no audio");
      const blob = new Blob([new Uint8Array(result.wav)], { type: "audio/wav" });
      const stt = await Dox.api.stt(blob, language);
      const el = focusedInput();
      if (el && stt?.text) {
        const cur = readValue(el);
        writeValue(el, (cur ? cur + " " : "") + stt.text);
      }
      if (statusEl) statusEl.textContent = t("dox_status_ready");
    } catch (e) {
      if (statusEl) statusEl.textContent = t("pad_error_stt");
    }
  }

  document.addEventListener(
    "focusin",
    (e) => {
      const el = e.target;
      if (!(el instanceof Element)) return;
      if (skipField(el)) return;
      if (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        lastField = el;
        if (bar && !dragging && !freezePlace) placeUnderField(el);
      }
    },
    true
  );

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "dox-ime-show") {
      Dox.prefs.set({ imeCollapsed: false, imeEnabled: true }).then(async () => {
        await mount();
        placeForShow();
      });
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (
      changes.imeEnabled ||
      changes.imeCollapsed ||
      changes.extensionEnabled ||
      changes.imeDialect ||
      changes.systemDialectId
    ) {
      Dox.locale.ready().then(mount);
    }
  });

  Dox.locale.ready().then(mount);

  Dox.ime = {
    writeValue,
    readValue,
    placeForShow,
    placeUnderField,
    skipField,
    AREA_INSET,
  };
})();
