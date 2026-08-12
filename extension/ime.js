/**
 * DialectsOnX IME — translate swaps text in focused website textboxes.
 * Full Pad with panes lives at https://dialex-app.com/#pad
 */
(function () {
  const catalog = globalThis.DialexCatalog;
  if (!catalog) return;

  const DEFAULT_BACKEND_URL =
    "https://dialex-backend-f6b7-1086119311146.europe-west3.run.app";
  const DIALEX_PAD_URL = "https://dialex-app.com/#pad";
  const DEFAULT_DIALECT = catalog.DEFAULT_DIALECT;
  const DEFAULT_LANGUAGE = catalog.DEFAULT_LANGUAGE;

  let preferredDialect = DEFAULT_DIALECT;
  let preferredLanguage = DEFAULT_LANGUAGE;
  let backendUrl = DEFAULT_BACKEND_URL;
  let barEl = null;
  let activeTarget = null;
  let originals = new WeakMap();
  let busy = false;

  function normalizeBackendUrl(url) {
    const trimmed = (url || "").trim().replace(/\/+$/, "");
    return trimmed || DEFAULT_BACKEND_URL;
  }

  function loadSettings() {
    chrome.storage.sync.get(
      {
        preferredDialect: DEFAULT_DIALECT,
        preferredLanguage: DEFAULT_LANGUAGE,
        backendUrl: DEFAULT_BACKEND_URL
      },
      (data) => {
        preferredDialect =
          catalog.normalizeDialectId(data.preferredDialect) || DEFAULT_DIALECT;
        preferredLanguage =
          data.preferredLanguage ||
          catalog.dialectById(preferredDialect)?.languageId ||
          DEFAULT_LANGUAGE;
        backendUrl = normalizeBackendUrl(data.backendUrl);
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
      preferredLanguage = changes.preferredLanguage.newValue || preferredLanguage;
    }
    if (changes.backendUrl) {
      backendUrl = normalizeBackendUrl(changes.backendUrl.newValue);
    }
    refreshBarLabels();
  });

  function isEditable(el) {
    if (!el || el.disabled || el.readOnly) return false;
    if (el instanceof HTMLTextAreaElement) return true;
    if (el instanceof HTMLInputElement) {
      const type = (el.type || "text").toLowerCase();
      return (
        type === "text" ||
        type === "search" ||
        type === "email" ||
        type === "url" ||
        type === "tel" ||
        type === "" ||
        type === "password"
      );
    }
    if (el.isContentEditable) return true;
    return false;
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
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
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
        background: #0a0b0c;
        border: 1px solid #2a2e33;
        box-shadow: 0 10px 30px rgba(0,0,0,0.45);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 12px;
        color: #e6e8ea;
      }
      #dialx-ime-bar select {
        appearance: none;
        background: #1c1f22;
        color: #e6e8ea;
        border: 1px solid #2a2e33;
        border-radius: 8px;
        padding: 5px 8px;
        font: inherit;
        max-width: 140px;
      }
      #dialx-ime-bar button, #dialx-ime-bar a {
        border-radius: 999px;
        border: 1px solid #2a2e33;
        background: #141618;
        color: #e6e8ea;
        padding: 5px 10px;
        font: inherit;
        cursor: pointer;
        text-decoration: none;
      }
      #dialx-ime-bar button.primary {
        background: #3d9b8f;
        border-color: #3d9b8f;
        color: #0a0b0c;
        font-weight: 700;
      }
      #dialx-ime-bar button:disabled {
        opacity: 0.55;
        cursor: default;
      }
      #dialx-ime-bar .status {
        color: #9aa3ad;
        min-width: 0;
      }
      #dialx-ime-bar .status.error { color: #cf6b6b; }
    `;
    document.documentElement.appendChild(style);
  }

  function ensureBar() {
    if (barEl) return barEl;
    injectStyles();
    barEl = document.createElement("div");
    barEl.id = "dialx-ime-bar";
    barEl.innerHTML = `
      <select id="dialx-ime-language" aria-label="Language"></select>
      <select id="dialx-ime-dialect" aria-label="Dialect"></select>
      <button type="button" class="primary" id="dialx-ime-translate">Translate</button>
      <button type="button" id="dialx-ime-toggle" hidden>Original</button>
      <a id="dialx-ime-pad" href="${DIALEX_PAD_URL}" target="_blank" rel="noopener noreferrer">Open Pad</a>
      <span class="status" id="dialx-ime-status"></span>
    `;
    document.documentElement.appendChild(barEl);

    const langSelect = barEl.querySelector("#dialx-ime-language");
    catalog.languages.forEach((lang) => {
      const opt = document.createElement("option");
      opt.value = lang.id;
      opt.textContent = lang.name;
      langSelect.appendChild(opt);
    });

    langSelect.addEventListener("change", () => {
      preferredLanguage = langSelect.value;
      const next = catalog.defaultDialectFor(preferredLanguage);
      preferredDialect = next?.id || DEFAULT_DIALECT;
      chrome.storage.sync.set({ preferredLanguage, preferredDialect });
      fillDialectSelect();
    });

    barEl.querySelector("#dialx-ime-dialect").addEventListener("change", (e) => {
      preferredDialect = e.target.value;
      preferredLanguage =
        catalog.dialectById(preferredDialect)?.languageId || preferredLanguage;
      chrome.storage.sync.set({ preferredDialect, preferredLanguage });
    });

    barEl.querySelector("#dialx-ime-translate").addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    barEl.querySelector("#dialx-ime-translate").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
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

  function fillDialectSelect() {
    if (!barEl) return;
    const dialectSelect = barEl.querySelector("#dialx-ime-dialect");
    const langSelect = barEl.querySelector("#dialx-ime-language");
    langSelect.value = preferredLanguage;
    dialectSelect.innerHTML = "";
    catalog.dialectsFor(preferredLanguage).forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.name;
      dialectSelect.appendChild(opt);
    });
    if (!catalog.dialectById(preferredDialect) ||
        catalog.dialectById(preferredDialect).languageId !== preferredLanguage) {
      preferredDialect =
        catalog.defaultDialectFor(preferredLanguage)?.id || DEFAULT_DIALECT;
    }
    dialectSelect.value = preferredDialect;
  }

  function refreshBarLabels() {
    if (!barEl) return;
    fillDialectSelect();
  }

  function positionBar(target) {
    const bar = ensureBar();
    const rect = target.getBoundingClientRect();
    const top = Math.min(window.innerHeight - 56, Math.max(8, rect.bottom + 8));
    let left = Math.max(8, Math.min(rect.left, window.innerWidth - bar.offsetWidth - 8));
    bar.style.top = `${top}px`;
    bar.style.left = `${left}px`;
    bar.hidden = false;
  }

  function hideBar() {
    if (barEl) barEl.hidden = true;
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
      setStatus("No text to translate", true);
      return;
    }
    busy = true;
    const btn = barEl.querySelector("#dialx-ime-translate");
    btn.disabled = true;
    setStatus("Translating…");
    try {
      if (!originals.has(target)) originals.set(target, readValue(target));
      const res = await fetch(`${normalizeBackendUrl(backendUrl)}/translate`, {
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
        } catch {
          /* ignore */
        }
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
      btn.disabled = false;
    }
  }

  function toggleOriginal() {
    const target = activeTarget;
    if (!target || !originals.has(target)) return;
    const original = originals.get(target);
    const current = readValue(target);
    if (current === original) {
      setStatus("Already original");
      return;
    }
    writeValue(target, original);
    setStatus("Restored original");
  }

  function onFocusIn(e) {
    const t = e.target;
    if (!isEditable(t)) return;
    // Skip X compose if feed content script handles posts — still allow IME on inputs
    activeTarget = t;
    ensureBar();
    fillDialectSelect();
    positionBar(t);
    setStatus("");
  }

  function onFocusOut(e) {
    // Keep bar if focus moves into the bar itself
    setTimeout(() => {
      const active = document.activeElement;
      if (barEl && (barEl === active || barEl.contains(active))) return;
      if (active && isEditable(active)) {
        activeTarget = active;
        positionBar(active);
        return;
      }
      hideBar();
    }, 0);
  }

  function onScrollOrResize() {
    if (activeTarget && document.activeElement === activeTarget) {
      positionBar(activeTarget);
    }
  }

  loadSettings();
  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("focusout", onFocusOut, true);
  window.addEventListener("scroll", onScrollOrResize, true);
  window.addEventListener("resize", onScrollOrResize);
})();
