  /* DialectsOnX chrome theme: quiet cool-dark, bundled Quicksand. */
globalThis.Dox = globalThis.Dox || {};

(function () {
  if (Dox.themeReady) return;
  Dox.themeReady = true;

  const FONT = '"Quicksand", ui-rounded, "Hiragino Maru Gothic ProN", sans-serif';
  Dox.THEME = {
    ink: "#000000",
    elevated: "#0E0E10",
    panel: "#151518",
    field: "#1C1C1F",
    line: "#2C2C31",
    text: "#F4F4F5",
    muted: "#8E8E93",
    accent: "#C7C7CC",
    onAccent: "#0E0E10",
    danger: "#FF453A",
    status: "#A8B4C0",
    font: FONT,
  };
  Dox.FONT = FONT;

  const ICONS = {
    search:
      "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
    close:
      "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
    chevron:
      "M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z",
    check:
      "M9 16.17 4.83 12l-1.41 1.41L9 19 21 7l-1.41-1.41z",
    star:
      "M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
    info:
      "M11 7h2v2h-2V7zm0 4h2v6h-2v-6zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z",
    back:
      "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
    gear:
      "M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.61l-1.92-3.32a.5.5 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.5.5 0 0 0-.48-.41h-3.84a.5.5 0 0 0-.47.41L9.25 5.35c-.59.24-1.13.57-1.62.94l-2.39-.96a.5.5 0 0 0-.59.22L2.74 8.87a.5.5 0 0 0 .12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.5.5 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.47.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.5.5 0 0 0-.12-.61l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z",
  };

  function fontUrl(file) {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
        return chrome.runtime.getURL("fonts/" + file);
      }
    } catch (_) {
      /* local page */
    }
    const path = String((typeof location !== "undefined" && location.pathname) || "");
    if (path.includes("/test/")) return "../fonts/" + file;
    return "fonts/" + file;
  }

  function injectTheme() {
    if (typeof document === "undefined") return;
    let style = document.getElementById("dox-theme");
    if (!style) {
      style = document.createElement("style");
      style.id = "dox-theme";
      (document.documentElement || document.head).appendChild(style);
    }
    const w500 = fontUrl("quicksand-500.woff2");
    const w600 = fontUrl("quicksand-600.woff2");
    const w700 = fontUrl("quicksand-700.woff2");
    style.textContent = `
      @font-face {
        font-family: "Quicksand";
        font-style: normal;
        font-weight: 500;
        font-display: swap;
        src: url("${w500}") format("woff2");
      }
      @font-face {
        font-family: "Quicksand";
        font-style: normal;
        font-weight: 600;
        font-display: swap;
        src: url("${w600}") format("woff2");
      }
      @font-face {
        font-family: "Quicksand";
        font-style: normal;
        font-weight: 700;
        font-display: swap;
        src: url("${w700}") format("woff2");
      }
      :root {
        --dox-ink: #000000;
        --dox-elevated: #0E0E10;
        --dox-panel: #151518;
        --dox-field: #1C1C1F;
        --dox-line: #2C2C31;
        --dox-text: #F4F4F5;
        --dox-muted: #8E8E93;
        --dox-accent: #C7C7CC;
        --dox-on-accent: #0E0E10;
        --dox-danger: #FF453A;
        --dox-status: #A8B4C0;
        --dox-font: ${FONT};
        --dox-focus: rgba(244, 244, 245, 0.35);
        --dox-accent-hover: rgba(244, 244, 245, 0.12);
        --dox-faw-hi: rgba(244, 244, 245, 0.16);
        --dox-logo-cap: 32px;
      }
      html, body.dox-settings, body.dox-popup, .dox-sheet, #dialx-ime-bar, .dox-faw-dlg, .dialx-control-bar {
        color-scheme: dark;
      }
      .dox-dots {
        display: inline;
        font: inherit;
        letter-spacing: inherit;
      }
      .dox-dots span {
        display: inline;
        font: inherit;
        font-style: normal;
        font-weight: inherit;
        line-height: inherit;
        animation: dox-dot 1s ease-in-out infinite;
      }
      .dox-dots span:nth-child(2) { animation-delay: .15s; }
      .dox-dots span:nth-child(3) { animation-delay: .3s; }
      @keyframes dox-dot {
        0%, 80%, 100% { opacity: 0.2; }
        40% { opacity: 1; }
      }
      @media (prefers-reduced-motion: reduce) {
        .dox-dots span { animation: none; opacity: 1; }
        .dox-sheet-chevron { transition: none; }
      }
      /* Wordmark ink in DialectsOnX-logo.png is 903×149 at (64,426) of 1024. */
      .dox-wordmark {
        display: inline-block;
        height: var(--dox-logo-cap, 32px);
        width: calc(var(--dox-logo-cap, 32px) * 903 / 149);
        flex-shrink: 0;
        pointer-events: none;
        overflow: hidden;
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        -webkit-mask-size: calc(var(--dox-logo-cap, 32px) * 1024 / 149);
        mask-size: calc(var(--dox-logo-cap, 32px) * 1024 / 149);
        -webkit-mask-position: calc(var(--dox-logo-cap, 32px) * -64 / 149)
          calc(var(--dox-logo-cap, 32px) * -426 / 149);
        mask-position: calc(var(--dox-logo-cap, 32px) * -64 / 149)
          calc(var(--dox-logo-cap, 32px) * -426 / 149);
        mask-mode: luminance;
      }
      .dox-status-busy,
      .dialx-status.is-busy,
      .dialx-status.dox-status-busy { color: var(--dox-status, #A8B4C0); }
      .dox-status-error,
      .dialx-status.is-error,
      .dialx-status.dox-status-error { color: var(--dox-danger, #FF453A); }
      .dox-sheet-scrim :focus-visible,
      .dox-sys :focus-visible,
      .dox-popup :focus-visible,
      .dox-settings :focus-visible,
      #dialx-ime-bar :focus-visible,
      .dox-faw-dlg :focus-visible,
      .dialx-control-bar :focus-visible,
      .dox-hint:focus-visible {
        outline: 1px solid var(--dox-focus);
        outline-offset: 2px;
      }
      .dox-icon-btn {
        width: 44px; height: 44px; flex-shrink: 0;
        display: inline-flex; align-items: center; justify-content: center;
        background: transparent; border: 0; padding: 0;
        color: var(--dox-muted);
        cursor: pointer;
        border-radius: 8px;
      }
      .dox-icon-btn:hover { color: #B4B4B8; }
      .dox-icon-btn svg { width: 16px; height: 16px; display: block; }
      .dox-outline-btn {
        background: transparent;
        color: var(--dox-text);
        border: 1px solid var(--dox-accent);
        border-radius: 8px;
        font: 600 13px var(--dox-font);
        padding: 10px 12px;
        cursor: pointer;
      }
      .dox-outline-btn:hover { background: var(--dox-accent-hover); }
      .dox-dialex-wordmark {
        display: inline-block;
        height: 1em;
        width: auto;
        vertical-align: -0.12em;
      }
      .dox-ime-show-label {
        display: inline-flex;
        align-items: center;
        gap: 0.35em;
        font: inherit;
        color: inherit;
      }
    `;
  }

  Dox.icon = function (name, size) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", String(size || 16));
    svg.setAttribute("height", String(size || 16));
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("fill", "currentColor");
    path.setAttribute("d", ICONS[name] || ICONS.close);
    svg.appendChild(path);
    return svg;
  };

  Dox.iconButton = function (name, opts) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = (opts && opts.className) || "dox-icon-btn";
    const label = (opts && (opts.title || opts.label)) || "";
    if (label) {
      btn.title = label;
      btn.setAttribute("aria-label", label);
    }
    btn.appendChild(Dox.icon(name, (opts && opts.size) || 16));
    return btn;
  };

  Dox.bindActivate = function (el, fn) {
    el.addEventListener("click", fn);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fn(e);
      }
    });
  };

  Dox.stripStatusEllipsis = function (message) {
    return String(message || "").replace(/[.…⋯]+$/u, "").trimEnd();
  };

  Dox.fillBusyStatus = function (el, message) {
    if (!el) return;
    el.classList.add("dox-status-busy", "is-busy");
    el.classList.remove("dox-status-error", "is-error");
    el.replaceChildren();
    el.setAttribute("aria-label", String(message || ""));
    el.appendChild(document.createTextNode(Dox.stripStatusEllipsis(message)));
    const dots = document.createElement("span");
    dots.className = "dox-dots";
    dots.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 3; i += 1) {
      const d = document.createElement("span");
      d.textContent = ".";
      dots.appendChild(d);
    }
    el.appendChild(dots);
  };

  Dox.fillErrorStatus = function (el, message) {
    if (!el) return;
    el.classList.add("dox-status-error", "is-error");
    el.classList.remove("dox-status-busy", "is-busy");
    el.removeAttribute("aria-label");
    el.textContent = message || "";
  };

  Dox.isTranslatingStatus = function (message) {
    try {
      return message === Dox.locale.t("status_translating");
    } catch (_) {
      return /…|...$/.test(String(message || "")) && /translat|ترجم|翻訳|번역/i.test(String(message || ""));
    }
  };

  Dox.dialexWordmark = function (heightPx) {
    const img = document.createElement("img");
    img.className = "dox-dialex-wordmark";
    img.alt = "Dialex";
    img.width = 72;
    img.height = heightPx || 14;
    try {
      if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
        img.src = chrome.runtime.getURL("Dialex-wordmark.svg");
      } else {
        const path = String((typeof location !== "undefined" && location.pathname) || "");
        img.src = path.includes("/test/") ? "../Dialex-wordmark.svg" : "Dialex-wordmark.svg";
      }
    } catch (_) {
      img.src = "Dialex-wordmark.svg";
    }
    return img;
  };

  Dox.fillImeShowLabel = function (el) {
    if (!el) return;
    const t = Dox.locale.t;
    el.replaceChildren();
    const wrap = document.createElement("span");
    wrap.className = "dox-ime-show-label";
    wrap.append(t("dox_ime_show_lead"), " ", Dox.dialexWordmark(14), " ", t("dox_ime"));
    el.appendChild(wrap);
  };

  Dox.openSettings = function () {
    try {
      const extPage =
        typeof location !== "undefined" && location.protocol === "chrome-extension:";
      if (
        !extPage &&
        typeof chrome !== "undefined" &&
        chrome.runtime?.sendMessage &&
        chrome.runtime.id
      ) {
        chrome.runtime.sendMessage({ type: "dox-open-settings" });
        return;
      }
      if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
        chrome.runtime.openOptionsPage();
        return;
      }
      if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
        window.open(chrome.runtime.getURL("settings.html"));
        return;
      }
    } catch (_) {
      /* fall through */
    }
    window.open("settings.html");
  };

  injectTheme();
})();
