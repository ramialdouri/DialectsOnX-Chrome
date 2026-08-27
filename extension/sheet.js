/* Dialex two-panel catalog sheet: favorites/recents, Language | Dialect, 90vh. */
globalThis.Dox = globalThis.Dox || {};

(function () {
  if (Dox.sheet) return;
  const DAMASCUS = "arabic_syrian_damascus";
  const SLOT = 16;
  let host = null;
  let onPick = null;
  let mode = "default";
  let selectedId = "";
  let browseSpokenId = "";
  let search = "";
  let expandedGroups = new Set();
  let hintPopup = null;
  let hamaTimer = null;
  let measureCtx = null;
  let searchInput = null;

  function t(key, ...args) {
    return Dox.locale.t(key, ...args);
  }

  function injectSheetStyles() {
    let style = document.getElementById("dox-sheet-styles");
    if (!style) {
      style = document.createElement("style");
      style.id = "dox-sheet-styles";
      document.documentElement.appendChild(style);
    }
    style.textContent = `
      .dox-sheet-scrim {
        position: fixed; inset: 0; z-index: 2147483000;
        background: rgba(0,0,0,.55);
        display: flex; align-items: center; justify-content: center;
        font-family: var(--dox-font, ${Dox.FONT});
      }
      .dox-sheet {
        position: relative;
        height: 90vh;
        max-height: 90vh;
        width: max-content;
        max-width: calc(100vw - 24px);
        background: var(--dox-elevated, #0E0E10);
        color: var(--dox-text, #F4F4F5);
        border: 1px solid var(--dox-line, #2C2C31);
        border-radius: 12px;
        display: flex; flex-direction: column;
        overflow: hidden;
        box-shadow: 0 12px 48px rgba(0,0,0,.55);
      }
      .dox-sheet-chrome {
        position: absolute; top: 0; inset-inline-end: 0; z-index: 2;
        display: flex; align-items: center;
        height: 44px;
      }
      .dox-sheet-settings,
      .dox-sheet-close {
        width: 44px; height: 44px;
        background: transparent; border: 0; color: var(--dox-muted, #8E8E93);
        cursor: pointer; padding: 0;
        display: inline-flex; align-items: center; justify-content: center;
      }
      .dox-sheet-settings:hover,
      .dox-sheet-close:hover { color: #B4B4B8; }
      .dox-sheet-settings svg,
      .dox-sheet-close svg { width: 16px; height: 16px; display: block; }
      .dox-sheet-quick {
        flex-shrink: 0;
        padding: 12px 12px 10px;
        padding-inline-end: 96px;
        display: flex; flex-direction: column; gap: 10px;
      }
      .dox-sheet-quick[hidden] { display: none; }
      .dox-sheet-section {
        font-size: 12px; font-weight: 700; color: var(--dox-muted, #8E8E93);
        margin: 0 0 6px; white-space: nowrap;
      }
      .dox-sheet-chip-row {
        display: flex; gap: 8px; overflow-x: auto;
        max-width: 100%;
      }
      .dox-sheet-quick-chip {
        flex: 0 0 auto;
        display: inline-flex; align-items: center; gap: 4px;
        background: var(--dox-field, #1C1C1F); color: var(--dox-text, #F4F4F5);
        border: 1px solid var(--dox-line, #2C2C31); border-radius: 999px;
        padding: 6px 10px; font: 600 12px var(--dox-font, ${Dox.FONT});
        cursor: pointer; white-space: nowrap;
      }
      .dox-sheet-quick-chip.selected { border-color: var(--dox-accent, #8A7C5C); }
      .dox-sheet-quick-chip .dox-sheet-star {
        width: 28px; height: 28px; margin: -6px;
        opacity: 1; color: var(--dox-accent, #8A7C5C);
      }
      .dox-sheet-split {
        flex: 1; min-height: 0;
        display: flex; flex-direction: row;
        gap: 12px;
        padding: 0 12px 16px;
        overflow-x: auto;
      }
      .dox-sheet-lang-panel,
      .dox-sheet-dialect-panel {
        min-height: 0;
        display: flex; flex-direction: column;
        background: var(--dox-panel, #151518);
        border: 1px solid var(--dox-line, #2C2C31);
        border-radius: 12px;
        overflow: hidden;
        flex: 0 0 auto;
      }
      .dox-sheet-lang-panel {
        flex: 0.45 0 auto;
        width: var(--dox-lang-min, max-content);
        min-width: var(--dox-lang-min, max-content);
      }
      .dox-sheet-dialect-panel {
        flex: 0.55 0 auto;
        width: var(--dox-dialect-min, max-content);
        min-width: var(--dox-dialect-min, max-content);
      }
      .dox-sheet-search-row,
      .dox-sheet-plate-wrap {
        flex-shrink: 0;
        display: flex; align-items: center;
        padding: 8px;
        height: auto;
        box-sizing: border-box;
      }
      .dox-sheet-search,
      .dox-sheet-plate {
        display: flex; align-items: center; gap: 4px;
        width: 100%;
        height: 36px;
        box-sizing: border-box;
        background: var(--dox-field, #1C1C1F);
        border: 1px solid var(--dox-line, #2C2C31);
        border-radius: 8px;
        padding: 0 10px;
        min-width: 0;
      }
      .dox-sheet-plate {
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
      }
      .dox-sheet-plate-label {
        white-space: nowrap; overflow: hidden; text-overflow: clip;
        font-size: 13px; font-weight: 700;
      }
      .dox-sheet-search input {
        flex: 1; min-width: 0;
        background: transparent; border: 0; color: var(--dox-text, #F4F4F5);
        font: 600 13px var(--dox-font, ${Dox.FONT}); outline: none;
      }
      .dox-sheet-search input::placeholder { color: var(--dox-muted, #8E8E93); }
      .dox-sheet-search:focus-within { border-color: var(--dox-accent, #8A7C5C); }
      .dox-sheet-search-icon {
        color: var(--dox-muted, #8E8E93); flex-shrink: 0;
        width: 16px; height: 16px; display: inline-flex;
      }
      .dox-sheet-search-icon svg { width: 16px; height: 16px; display: block; }
      .dox-sheet-search-clear {
        width: 36px; height: 36px; flex-shrink: 0;
        background: none; border: 0; color: var(--dox-muted, #8E8E93); cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center;
        padding: 0;
      }
      .dox-sheet-search-clear svg { width: 16px; height: 16px; display: block; }
      .dox-sheet-lang-list,
      .dox-sheet-dialect-list {
        flex: 1; min-height: 0; overflow: auto;
      }
      .dox-sheet-group {
        display: flex; align-items: center;
        padding: 10px 16px;
        cursor: pointer; user-select: none;
        gap: 8px;
      }
      .dox-sheet-group-label {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--dox-muted, #8E8E93);
        white-space: nowrap;
      }
      .dox-sheet-chevron {
        margin-inline-start: auto;
        width: 20px; height: 20px;
        color: var(--dox-muted, #8E8E93);
        display: inline-flex; align-items: center; justify-content: center;
        transition: transform .2s;
        flex-shrink: 0;
      }
      .dox-sheet-chevron svg { width: 16px; height: 16px; display: block; }
      .dox-sheet-chevron.open { transform: rotate(180deg); }
      .dox-sheet-lang-row,
      .dox-sheet-dialect-row {
        display: flex; align-items: center; gap: 8px;
        padding: 10px 16px;
        cursor: pointer;
        min-width: 0;
      }
      .dox-sheet-lang-row:hover .dox-sheet-lang-name,
      .dox-sheet-dialect-row:hover .dox-sheet-chip {
        color: var(--dox-text, #F4F4F5);
      }
      .dox-sheet-lang-name,
      .dox-sheet-chip,
      .dox-sheet-lang-support {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: clip;
        font-size: 13px;
      }
      .dox-sheet-lang-grow,
      .dox-sheet-dialect-grow {
        flex: 1; min-width: 0;
        display: flex; flex-direction: column;
      }
      .dox-sheet-lang-name {
        font-weight: 600; color: var(--dox-muted, #8E8E93);
      }
      .dox-sheet-lang-row.selected .dox-sheet-lang-name { color: var(--dox-text, #F4F4F5); }
      .dox-sheet-lang-support {
        font-size: 12px; font-weight: 500; color: var(--dox-muted, #8E8E93);
      }
      .dox-sheet-chip {
        background: none; border: 0; color: var(--dox-muted, #8E8E93);
        font: 600 13px var(--dox-font, ${Dox.FONT});
        padding: 0; text-align: start; width: 100%;
        pointer-events: none;
      }
      .dox-sheet-chip.selected, .dox-sheet-chip.hit { color: var(--dox-text, #F4F4F5); }
      .dox-sheet-slot {
        width: ${SLOT}px; height: ${SLOT}px;
        flex-shrink: 0;
        display: inline-flex; align-items: center; justify-content: center;
        position: relative;
      }
      .dox-sheet-i, .dox-sheet-star, .dox-sheet-check {
        width: 32px; height: 32px; margin: -8px;
        flex-shrink: 0;
        background: none; border: 0; cursor: pointer;
        color: var(--dox-muted, #8E8E93);
        padding: 0;
        display: inline-flex; align-items: center; justify-content: center;
      }
      .dox-sheet-i svg, .dox-sheet-star svg, .dox-sheet-check svg {
        width: 16px; height: 16px; display: block;
      }
      .dox-sheet-star { opacity: .35; color: var(--dox-muted, #8E8E93); }
      .dox-sheet-star.on { opacity: 1; color: var(--dox-accent, #8A7C5C); }
      .dox-sheet-check { color: var(--dox-accent, #8A7C5C); cursor: default; margin: 0; width: 16px; height: 16px; }
      .dox-hint {
        position: absolute; z-index: 2147483001;
        background: var(--dox-elevated, #0E0E10); color: var(--dox-text, #F4F4F5);
        border: 1px solid var(--dox-accent, #8A7C5C);
        border-radius: 12px; padding: 8px 10px; max-width: 240px;
        font-size: 12px; font-family: var(--dox-font, ${Dox.FONT}); cursor: pointer;
      }
      .dox-hint.is-plain { cursor: default; }
      .dox-sheet-auto {
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px; padding: 4px 8px 10px;
        font: 600 13px var(--dox-font, ${Dox.FONT});
        color: var(--dox-text, #F4F4F5);
      }
      .dox-sheet-auto .dox-switch {
        appearance: none; -webkit-appearance: none;
        width: 40px; height: 24px; margin: 0;
        background: var(--dox-line, #2C2C31);
        border-radius: 999px; position: relative; cursor: pointer; border: 0; flex-shrink: 0;
      }
      .dox-sheet-auto .dox-switch::after {
        content: ""; position: absolute; width: 18px; height: 18px; border-radius: 50%;
        background: var(--dox-muted, #8E8E93); top: 3px; inset-inline-start: 3px;
        transition: inset-inline-start .15s ease, background .15s ease;
      }
      .dox-sheet-auto .dox-switch:checked { background: rgba(138, 124, 92, 0.35); }
      .dox-sheet-auto .dox-switch:checked::after {
        background: var(--dox-accent, #8A7C5C); inset-inline-start: 19px;
      }
      @media (prefers-reduced-motion: reduce) {
        .dox-sheet-auto .dox-switch::after { transition: none; }
      }
    `;
  }

  function textWidth(text, px, weight) {
    if (!measureCtx) {
      measureCtx = document.createElement("canvas").getContext("2d");
    }
    measureCtx.font = (weight || 600) + " " + (px || 13) + "px " + Dox.FONT;
    return measureCtx.measureText(String(text || "")).width;
  }

  function applyColumnMins(sheetEl) {
    let langInner = 0;
    for (const group of Dox.CATALOG.groups) {
      langInner = Math.max(langInner, textWidth(Dox.locale.groupLabel(group.id), 11, 700) + 12 + 20);
      for (const lang of group.languages) {
        const label = Dox.locale.languageLabel(lang.id);
        langInner = Math.max(langInner, textWidth(label, 13, 600) + SLOT);
      }
    }
    let dialectInner = 0;
    for (const id of Dox.CATALOG.ids) {
      dialectInner = Math.max(dialectInner, textWidth(Dox.locale.dialectChip(id), 13, 600));
    }
    const hintW = textWidth(t("language_search_hint"), 13, 600) + 18 + 36;
    langInner = Math.max(langInner, hintW);
    const langMin = Math.ceil(langInner + 32 + 8);
    const dialectMin = Math.ceil(dialectInner + SLOT * 3 + 8 * 3 + 32 + 8);
    sheetEl.style.setProperty("--dox-lang-min", langMin + "px");
    sheetEl.style.setProperty("--dox-dialect-min", dialectMin + "px");
  }

  function dialectsForSpoken(spokenId, prefs) {
    for (const group of Dox.CATALOG.groups) {
      for (const lang of group.languages) {
        if (lang.id !== spokenId) continue;
        return lang.dialects.filter((d) => !d.hidden || prefs.hamaUnlocked);
      }
    }
    return [];
  }

  function closeHint() {
    hintPopup?.remove();
    hintPopup = null;
  }

  function linksGrokHint(dialectId) {
    if (dialectId === "kurdish_kurmanji" || dialectId === "zulu_standard") return true;
    const spoken = Dox.spokenIdOf(dialectId);
    return dialectId !== Dox.standardDialectFor(spoken);
  }

  function showHint(anchor, dialectId) {
    closeHint();
    const text = Dox.locale.dialectHint(dialectId);
    if (!text) return;
    const pop = document.createElement("div");
    pop.className = "dox-hint";
    pop.textContent = text;
    if (linksGrokHint(dialectId)) {
      pop.setAttribute("role", "button");
      pop.tabIndex = 0;
      const go = (e) => {
        e.stopPropagation();
        const q = Dox.locale.grokQuery(dialectId);
        window.open("https://grok.com/?q=" + encodeURIComponent(q), "_blank", "noopener");
        closeHint();
      };
      Dox.bindActivate(pop, go);
    } else {
      pop.classList.add("is-plain");
    }
    document.documentElement.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    const rtl = Dox.locale.rtl || document.documentElement.getAttribute("dir") === "rtl";
    const start = rtl ? window.innerWidth - r.right : r.left;
    pop.style.setProperty(
      "inset-inline-start",
      Math.max(8, Math.min(start, window.innerWidth - 260)) + "px"
    );
    pop.style.top = r.bottom + 6 + "px";
    hintPopup = pop;
  }

  async function persistDialect(dialectId) {
    if (mode === "ime") await Dox.prefs.setImeDialect(dialectId);
    else await Dox.prefs.setDefaultDialect(dialectId);
    selectedId = dialectId;
  }

  function emitPick(dialectId) {
    if (typeof onPick === "function") onPick(dialectId, mode);
  }

  async function pick(dialectId) {
    await persistDialect(dialectId);
    const cb = onPick;
    close();
    if (cb) cb(dialectId, mode);
  }

  async function selectLanguage(spokenId) {
    browseSpokenId = spokenId;
    search = "";
    if (searchInput) searchInput.value = "";
    const currentSpoken = Dox.spokenIdOf(selectedId);
    if (spokenId !== currentSpoken) {
      const std = Dox.standardDialectFor(spokenId);
      await persistDialect(std);
      emitPick(std);
    }
    await redraw();
  }

  function renderGroupHeader(group, expanded) {
    const row = document.createElement("div");
    row.className = "dox-sheet-group";
    row.dataset.groupId = group.id;
    row.setAttribute("role", "button");
    row.tabIndex = 0;
    const label = document.createElement("span");
    label.className = "dox-sheet-group-label";
    label.textContent = Dox.locale.groupLabel(group.id);
    row.appendChild(label);
    const chev = document.createElement("span");
    chev.className = "dox-sheet-chevron" + (expanded ? " open" : "");
    chev.appendChild(Dox.icon("chevron", 16));
    row.appendChild(chev);
    Dox.bindActivate(row, async () => {
      if (search.trim()) return;
      if (expandedGroups.has(group.id)) expandedGroups.delete(group.id);
      else expandedGroups.add(group.id);
      await redraw();
    });
    return row;
  }

  function renderLangRow(opts) {
    const { spokenId, selected, support, onClick } = opts;
    const row = document.createElement("div");
    row.className = "dox-sheet-lang-row" + (selected ? " selected" : "");
    row.dataset.spokenId = spokenId;
    row.setAttribute("role", "button");
    row.tabIndex = 0;
    const grow = document.createElement("div");
    grow.className = "dox-sheet-lang-grow";
    const name = document.createElement("div");
    name.className = "dox-sheet-lang-name";
    name.textContent = Dox.locale.languageLabel(spokenId);
    grow.appendChild(name);
    if (support) {
      const sub = document.createElement("div");
      sub.className = "dox-sheet-lang-support";
      sub.textContent = support;
      grow.appendChild(sub);
    }
    row.appendChild(grow);
    const slot = document.createElement("span");
    slot.className = "dox-sheet-slot";
    if (selected) {
      const check = document.createElement("span");
      check.className = "dox-sheet-check";
      check.appendChild(Dox.icon("check", 16));
      slot.appendChild(check);
    }
    row.appendChild(slot);
    Dox.bindActivate(row, onClick);
    return row;
  }

  function bindHamaHold(row, prefs) {
    if (prefs.hamaUnlocked) {
      Dox.bindActivate(row, () => pick(DAMASCUS));
      return;
    }
    let holding = false;
    let unlocked = false;
    row.addEventListener("pointerdown", (e) => {
      if (e.button) return;
      holding = true;
      unlocked = false;
      try { row.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      hamaTimer = setTimeout(async () => {
        if (!holding) return;
        unlocked = true;
        await Dox.prefs.set({ hamaUnlocked: true });
        await redraw();
      }, Dox.CATALOG.hamaHoldMs);
    });
    const endHold = () => {
      if (!holding) return;
      holding = false;
      clearTimeout(hamaTimer);
      if (!unlocked) pick(DAMASCUS);
    };
    row.addEventListener("pointerup", endHold);
    row.addEventListener("pointercancel", () => {
      holding = false;
      clearTimeout(hamaTimer);
    });
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pick(DAMASCUS);
      }
    });
  }

  function renderDialectRow(prefs, dialectId) {
    const row = document.createElement("div");
    row.className = "dox-sheet-dialect-row";
    row.dataset.dialectId = dialectId;
    row.setAttribute("role", "button");
    row.tabIndex = 0;
    const q = search.trim().toLowerCase();
    const chipName = Dox.locale.dialectChip(dialectId);
    const grow = document.createElement("div");
    grow.className = "dox-sheet-dialect-grow";
    const chip = document.createElement("span");
    chip.className = "dox-sheet-chip";
    chip.dataset.dialectId = dialectId;
    chip.textContent = chipName;
    if (selectedId === dialectId) chip.classList.add("selected");
    if (q && chipName.toLowerCase().includes(q)) chip.classList.add("hit");
    grow.appendChild(chip);
    row.appendChild(grow);

    const iSlot = document.createElement("span");
    iSlot.className = "dox-sheet-slot";
    const hint = Dox.locale.dialectHint(dialectId);
    if (hint) {
      const info = document.createElement("button");
      info.type = "button";
      info.className = "dox-sheet-i";
      info.title = t("cd_dialect_info", chipName);
      info.setAttribute("aria-label", t("cd_dialect_info", chipName));
      info.appendChild(Dox.icon("info", 16));
      info.addEventListener("click", (e) => {
        e.stopPropagation();
        showHint(info, dialectId);
      });
      iSlot.appendChild(info);
    }
    row.appendChild(iSlot);

    const checkSlot = document.createElement("span");
    checkSlot.className = "dox-sheet-slot";
    if (selectedId === dialectId) {
      const check = document.createElement("span");
      check.className = "dox-sheet-check";
      check.appendChild(Dox.icon("check", 16));
      checkSlot.appendChild(check);
    }
    row.appendChild(checkSlot);

    const star = document.createElement("button");
    star.type = "button";
    star.className = "dox-sheet-star" + (prefs.favorites.includes(dialectId) ? " on" : "");
    star.appendChild(Dox.icon("star", 16));
    star.title = t(
      prefs.favorites.includes(dialectId) ? "cd_dialect_unfavorite" : "cd_dialect_favorite",
      chipName
    );
    star.setAttribute("aria-label", star.title);
    star.addEventListener("click", async (e) => {
      e.stopPropagation();
      await Dox.prefs.toggleFavorite(dialectId);
      await redraw();
    });
    row.appendChild(star);

    if (dialectId === DAMASCUS) {
      bindHamaHold(row, prefs);
    } else {
      Dox.bindActivate(row, (e) => {
        if (e.target.closest(".dox-sheet-star, .dox-sheet-i")) return;
        pick(dialectId);
      });
    }
    return row;
  }

  function renderQuickChip(id, opts) {
    const wrap = document.createElement("div");
    wrap.className = "dox-sheet-quick-chip" + (id === selectedId ? " selected" : "");
    wrap.dataset.dialectId = id;
    wrap.setAttribute("role", "button");
    wrap.tabIndex = 0;
    const label = document.createElement("span");
    label.textContent = Dox.locale.dialectChip(id);
    wrap.appendChild(label);
    if (opts && opts.star) {
      const star = document.createElement("button");
      star.type = "button";
      star.className = "dox-sheet-star on";
      star.appendChild(Dox.icon("star", 14));
      star.title = t("cd_dialect_unfavorite", Dox.locale.dialectChip(id));
      star.setAttribute("aria-label", star.title);
      star.addEventListener("click", async (e) => {
        e.stopPropagation();
        await Dox.prefs.toggleFavorite(id);
        await redraw();
      });
      wrap.appendChild(star);
    }
    Dox.bindActivate(wrap, (e) => {
      if (e.target.closest(".dox-sheet-star")) return;
      pick(id);
    });
    return wrap;
  }

  function renderQuick(prefs) {
    const box = host.querySelector(".dox-sheet-quick");
    const recents = (prefs.recents || []).filter((id) => id !== selectedId);
    const favs = prefs.favorites || [];
    box.replaceChildren();
    if (!favs.length && !recents.length) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    if (favs.length) {
      const h = document.createElement("div");
      h.className = "dox-sheet-section";
      h.textContent = t("dialect_favorites");
      const row = document.createElement("div");
      row.className = "dox-sheet-chip-row";
      favs.forEach((id) => row.appendChild(renderQuickChip(id, { star: true })));
      box.append(h, row);
    }
    if (recents.length) {
      const h = document.createElement("div");
      h.className = "dox-sheet-section";
      h.textContent = t("dialect_recents");
      const row = document.createElement("div");
      row.className = "dox-sheet-chip-row";
      recents.forEach((id) => row.appendChild(renderQuickChip(id)));
      box.append(h, row);
    }
  }

  function languageRows(prefs) {
    const q = search.trim().toLowerCase();
    const selectedSpoken = Dox.spokenIdOf(selectedId);
    const rows = [];
    if (!q) {
      for (const group of Dox.CATALOG.groups) {
        const headerless = group.id === "en";
        const expanded = expandedGroups.has(group.id);
        if (!headerless) {
          rows.push({ kind: "group", group, expanded });
        }
        if (headerless || expanded) {
          for (const lang of group.languages) {
            rows.push({
              kind: "lang",
              spokenId: lang.id,
              selected: lang.id === selectedSpoken,
            });
          }
        }
      }
      return rows;
    }
    for (const group of Dox.CATALOG.groups) {
      for (const lang of group.languages) {
        const langLabel = Dox.locale.languageLabel(lang.id);
        if (langLabel.toLowerCase().includes(q)) {
          rows.push({
            kind: "lang",
            spokenId: lang.id,
            selected: lang.id === selectedSpoken,
          });
        }
        for (const d of dialectsForSpoken(lang.id, prefs)) {
          const chip = Dox.locale.dialectChip(d.id);
          if (chip.toLowerCase().includes(q)) {
            rows.push({
              kind: "dialect",
              spokenId: lang.id,
              dialectId: d.id,
              selected: d.id === selectedId,
              support: chip,
            });
          }
        }
      }
    }
    return rows;
  }

  function renderLangList(prefs) {
    const list = host.querySelector(".dox-sheet-lang-list");
    const top = list.scrollTop;
    list.replaceChildren();
    for (const row of languageRows(prefs)) {
      if (row.kind === "group") {
        list.appendChild(renderGroupHeader(row.group, row.expanded));
      } else if (row.kind === "lang") {
        list.appendChild(
          renderLangRow({
            spokenId: row.spokenId,
            selected: row.selected,
            onClick: () => selectLanguage(row.spokenId),
          })
        );
      } else {
        const node = renderLangRow({
          spokenId: row.spokenId,
          selected: row.selected,
          support: row.support,
          onClick: async () => {
            browseSpokenId = row.spokenId;
            search = "";
            if (searchInput) searchInput.value = "";
            await pick(row.dialectId);
          },
        });
        node.dataset.dialectId = row.dialectId;
        list.appendChild(node);
      }
    }
    list.scrollTop = top;
  }

  function renderDialectPanel(prefs) {
    const plate = host.querySelector(".dox-sheet-plate-label");
    plate.textContent = Dox.locale.dialectChip(selectedId);
    const list = host.querySelector(".dox-sheet-dialect-list");
    const keepScroll =
      Dox.spokenIdOf(selectedId) === browseSpokenId ? list.scrollTop : 0;
    const prevSpoken = list.dataset.spokenId;
    list.replaceChildren();
    list.dataset.spokenId = browseSpokenId;
    for (const d of dialectsForSpoken(browseSpokenId, prefs)) {
      list.appendChild(renderDialectRow(prefs, d.id));
    }
    list.scrollTop = prevSpoken === browseSpokenId ? keepScroll : 0;
  }

  async function redraw() {
    if (!host) return;
    const prefs = await Dox.prefs.get();
    const selectedGroup = (Dox.CATALOG.spokenLanguages[Dox.spokenIdOf(selectedId)] || {}).group;
    if (selectedGroup) expandedGroups.add(selectedGroup);
    renderQuick(prefs);
    renderLangList(prefs);
    renderDialectPanel(prefs);
    const clearBtn = host.querySelector(".dox-sheet-search-clear");
    if (clearBtn) clearBtn.hidden = !search.trim();
  }

  function close() {
    closeHint();
    clearTimeout(hamaTimer);
    host?.remove();
    host = null;
    searchInput = null;
    onPick = null;
    document.removeEventListener("keydown", onKey);
  }

  function onKey(e) {
    if (e.key === "Escape") close();
  }

  async function open(options) {
    injectSheetStyles();
    close();
    mode = options.mode || "default";
    selectedId = options.selectedId || "";
    onPick = options.onPick || null;
    search = "";
    await Dox.locale.ready();
    const prefs = await Dox.prefs.get();
    if (!selectedId) {
      selectedId = mode === "ime" ? prefs.imeDialect : prefs.preferredDialect;
    }
    browseSpokenId = Dox.spokenIdOf(selectedId) || "arabic";
    expandedGroups = new Set(Dox.CATALOG.groups.map((g) => g.id));
    const selectedGroup = (Dox.CATALOG.spokenLanguages[browseSpokenId] || {}).group;
    if (selectedGroup) expandedGroups.add(selectedGroup);

    host = document.createElement("div");
    host.className = "dox-sheet-scrim";
    const sheet = document.createElement("div");
    sheet.className = "dox-sheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", t("label_dialect_selector"));
    Dox.locale.applyDir(sheet);
    applyColumnMins(sheet);

    const chromeRow = document.createElement("div");
    chromeRow.className = "dox-sheet-chrome";
    const settingsBtn = Dox.iconButton("gear", {
      className: "dox-sheet-settings",
      title: t("home_settings"),
    });
    settingsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      Dox.openSettings();
    });
    const closeBtn = Dox.iconButton("close", {
      className: "dox-sheet-close",
      title: t("settings_cancel"),
    });
    closeBtn.addEventListener("click", close);
    chromeRow.append(settingsBtn, closeBtn);

    const quick = document.createElement("div");
    quick.className = "dox-sheet-quick";

    const split = document.createElement("div");
    split.className = "dox-sheet-split";

    const langPanel = document.createElement("div");
    langPanel.className = "dox-sheet-lang-panel";
    const searchRow = document.createElement("div");
    searchRow.className = "dox-sheet-search-row";
    const searchBox = document.createElement("div");
    searchBox.className = "dox-sheet-search";
    const searchIcon = document.createElement("span");
    searchIcon.className = "dox-sheet-search-icon";
    searchIcon.appendChild(Dox.icon("search", 16));
    searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.placeholder = t("language_search_hint");
    searchInput.setAttribute("aria-label", t("cd_language_search"));
    searchInput.addEventListener("input", async () => {
      search = searchInput.value;
      await redraw();
    });
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "dox-sheet-search-clear";
    clearBtn.title = t("cd_language_search_clear");
    clearBtn.setAttribute("aria-label", t("cd_language_search_clear"));
    clearBtn.appendChild(Dox.icon("close", 16));
    clearBtn.hidden = true;
    clearBtn.addEventListener("click", async () => {
      search = "";
      searchInput.value = "";
      await redraw();
      searchInput.focus();
    });
    searchBox.append(searchIcon, searchInput, clearBtn);
    searchRow.appendChild(searchBox);
    const langList = document.createElement("div");
    langList.className = "dox-sheet-lang-list";
    if (mode !== "ime") {
      const autoRow = document.createElement("label");
      autoRow.className = "dox-sheet-auto";
      const autoLabel = document.createElement("span");
      autoLabel.textContent = t("dox_auto_translate");
      const autoInput = document.createElement("input");
      autoInput.type = "checkbox";
      autoInput.className = "dox-switch";
      autoInput.setAttribute("role", "switch");
      autoInput.checked = prefs.autoTranslate === true;
      autoInput.setAttribute("aria-checked", autoInput.checked ? "true" : "false");
      autoInput.addEventListener("change", async () => {
        autoInput.setAttribute("aria-checked", autoInput.checked ? "true" : "false");
        await Dox.prefs.set({ autoTranslate: autoInput.checked });
      });
      autoRow.append(autoLabel, autoInput);
      langPanel.append(searchRow, autoRow, langList);
    } else {
      langPanel.append(searchRow, langList);
    }

    const dialectPanel = document.createElement("div");
    dialectPanel.className = "dox-sheet-dialect-panel";
    const plateWrap = document.createElement("div");
    plateWrap.className = "dox-sheet-plate-wrap";
    const plate = document.createElement("div");
    plate.className = "dox-sheet-plate";
    const plateLabel = document.createElement("span");
    plateLabel.className = "dox-sheet-plate-label";
    plate.appendChild(plateLabel);
    plateWrap.appendChild(plate);
    const dialectList = document.createElement("div");
    dialectList.className = "dox-sheet-dialect-list";
    dialectPanel.append(plateWrap, dialectList);

    split.append(langPanel, dialectPanel);
    sheet.append(chromeRow, quick, split);
    host.appendChild(sheet);
    host.addEventListener("click", (e) => {
      if (e.target === host) close();
      else if (hintPopup && !hintPopup.contains(e.target) && !e.target.closest(".dox-sheet-i")) {
        closeHint();
      }
    });
    document.documentElement.appendChild(host);
    document.addEventListener("keydown", onKey);
    await redraw();
    searchInput.focus();
  }

  Dox.sheet = { open, close };
})();
