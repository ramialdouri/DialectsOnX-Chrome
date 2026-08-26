/* Dialex catalog sheet: 90vh, intrinsic width, gold group headers. */
globalThis.Dox = globalThis.Dox || {};

(function () {
  if (Dox.sheet) return;
  const GOLD = "#E0B83A";
  const GOLD_SHADOW = "#9A6F12";
  const GOLD_LABEL = "#3D2A08";
  let host = null;
  let onPick = null;
  let mode = "default";
  let selectedId = "";
  let search = "";
  let collapsed = new Set();
  let hintPopup = null;
  let hamaTimer = null;

  function t(key, ...args) {
    return Dox.locale.t(key, ...args);
  }

  function injectSheetStyles() {
    if (document.getElementById("dox-sheet-styles")) return;
    const style = document.createElement("style");
    style.id = "dox-sheet-styles";
    style.textContent = `
      .dox-sheet-scrim {
        position: fixed; inset: 0; z-index: 2147483000;
        background: rgba(0,0,0,.45);
        display: flex; align-items: center; justify-content: center;
        font-family: ${Dox.FONT};
      }
      .dox-sheet {
        height: 90vh;
        max-height: 90vh;
        width: max-content;
        max-width: calc(100vw - 24px);
        background: #16181c;
        color: #e7e9ea;
        border: 1px solid #2f3336;
        border-radius: 16px;
        display: flex; flex-direction: column;
        overflow: hidden;
        box-shadow: 0 12px 48px rgba(0,0,0,.55);
      }
      .dox-sheet-head {
        display: flex; align-items: center; gap: 8px;
        padding: 10px 12px 8px;
        border-bottom: 1px solid #2f3336;
        flex-shrink: 0;
      }
      .dox-sheet-search {
        flex: 1; min-width: 12em;
        background: #0f1113; border: 1px solid #2f3336; border-radius: 10px;
        color: #e7e9ea; padding: 8px 10px; font: inherit; font-size: 13px;
      }
      .dox-sheet-search:focus { outline: none; border-color: ${GOLD}; }
      .dox-sheet-close {
        background: transparent; border: 0; color: #8b98a5; cursor: pointer;
        font-size: 20px; line-height: 1; padding: 4px 8px;
      }
      .dox-sheet-body {
        flex: 1; overflow: auto; padding: 6px 8px 16px;
      }
      .dox-sheet-cols {
        display: grid;
        grid-template-columns: max-content max-content;
        column-gap: 16px;
        align-items: start;
      }
      .dox-sheet-group {
        grid-column: 1 / -1;
        margin: 10px 0 4px;
        background: linear-gradient(${GOLD}, ${GOLD} 70%, ${GOLD_SHADOW});
        color: ${GOLD_LABEL};
        font-weight: 700; font-size: 12px;
        padding: 3px 8px; border-radius: 6px;
        cursor: pointer; user-select: none;
        white-space: nowrap;
        width: max-content;
      }
      .dox-sheet-section {
        font-size: 12px; font-weight: 700; color: #8b98a5;
        margin: 8px 0 4px; white-space: nowrap;
      }
      .dox-sheet-row {
        display: contents;
      }
      .dox-sheet-lang, .dox-sheet-dialect {
        white-space: nowrap;
        font-size: 13px;
        padding: 3px 4px;
        line-height: 1.35;
      }
      .dox-sheet-lang { color: #8b98a5; }
      .dox-sheet-dialect-cell {
        display: flex; align-items: center; gap: 6px;
        white-space: nowrap;
      }
      .dox-sheet-chip {
        background: none; border: 0; color: #e7e9ea;
        font: inherit; cursor: pointer; white-space: nowrap;
        padding: 0; text-align: start;
      }
      .dox-sheet-chip:hover { color: ${GOLD}; }
      .dox-sheet-i, .dox-sheet-star, .dox-sheet-check {
        width: 16px; height: 16px; flex-shrink: 0;
        background: none; border: 0; cursor: pointer; color: #8b98a5;
        padding: 0; font-size: 12px; line-height: 16px;
      }
      .dox-sheet-star.on { color: ${GOLD}; }
      .dox-sheet-star { opacity: .4; }
      .dox-sheet-star.on { opacity: 1; }
      .dox-sheet-check { color: ${GOLD}; }
      .dox-hint {
        position: absolute; z-index: 2147483001;
        background: #0f1113; color: #e7e9ea; border: 1px solid ${GOLD};
        border-radius: 10px; padding: 8px 10px; max-width: 240px;
        font-size: 12px; cursor: pointer;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function visibleDialects(prefs) {
    const q = search.trim().toLowerCase();
    const out = [];
    for (const group of Dox.CATALOG.groups) {
      const langs = [];
      for (const lang of group.languages) {
        const dialects = lang.dialects.filter((d) => {
          if (d.hidden && !prefs.hamaUnlocked) return false;
          if (!q) return true;
          const chip = Dox.locale.dialectChip(d.id).toLowerCase();
          const spoken = Dox.locale.languageLabel(lang.id).toLowerCase();
          const endonym = (lang.endonym || "").toLowerCase();
          const groupL = Dox.locale.groupLabel(group.id).toLowerCase();
          return (
            chip.includes(q) ||
            spoken.includes(q) ||
            endonym.includes(q) ||
            groupL.includes(q) ||
            d.id.includes(q)
          );
        });
        if (dialects.length) langs.push({ ...lang, dialects });
      }
      if (langs.length) out.push({ ...group, languages: langs });
    }
    return out;
  }

  function closeHint() {
    hintPopup?.remove();
    hintPopup = null;
  }

  function showHint(anchor, dialectId) {
    closeHint();
    const text = Dox.locale.dialectHint(dialectId);
    if (!text) return;
    const pop = document.createElement("div");
    pop.className = "dox-hint";
    pop.textContent = text;
    pop.addEventListener("click", (e) => {
      e.stopPropagation();
      const q = Dox.locale.grokQuery(dialectId);
      window.open("https://grok.com/?q=" + encodeURIComponent(q), "_blank", "noopener");
      closeHint();
    });
    document.documentElement.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.min(r.left, window.innerWidth - 260) + "px";
    pop.style.top = r.bottom + 6 + "px";
    hintPopup = pop;
  }

  function renderRow(prefs, dialectId, spokenId, showLang) {
    const row = document.createElement("div");
    row.className = "dox-sheet-row";
    const lang = document.createElement("div");
    lang.className = "dox-sheet-lang";
    lang.textContent = showLang ? Dox.locale.languageLabel(spokenId) : "";
    const cell = document.createElement("div");
    cell.className = "dox-sheet-dialect-cell";
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "dox-sheet-chip";
    chip.textContent = Dox.locale.dialectChip(dialectId);
    chip.addEventListener("click", () => pick(dialectId));
    cell.appendChild(chip);
    const hint = Dox.locale.dialectHint(dialectId);
    if (hint) {
      const info = document.createElement("button");
      info.type = "button";
      info.className = "dox-sheet-i";
      info.textContent = "i";
      info.title = t("cd_dialect_info", Dox.locale.dialectChip(dialectId));
      info.addEventListener("click", (e) => {
        e.stopPropagation();
        showHint(info, dialectId);
      });
      cell.appendChild(info);
    }
    if (selectedId === dialectId) {
      const check = document.createElement("span");
      check.className = "dox-sheet-check";
      check.textContent = "✓";
      cell.appendChild(check);
    }
    const star = document.createElement("button");
    star.type = "button";
    star.className = "dox-sheet-star" + (prefs.favorites.includes(dialectId) ? " on" : "");
    star.textContent = "★";
    star.addEventListener("click", async (e) => {
      e.stopPropagation();
      await Dox.prefs.toggleFavorite(dialectId);
      await redraw();
    });
    cell.appendChild(star);
    if (dialectId === "arabic_syrian_damascus") {
      let holding = false;
      chip.addEventListener("pointerdown", () => {
        holding = true;
        hamaTimer = setTimeout(async () => {
          if (!holding) return;
          await Dox.prefs.set({ hamaUnlocked: true });
          await redraw();
        }, Dox.CATALOG.hamaHoldMs);
      });
      const clear = () => {
        holding = false;
        clearTimeout(hamaTimer);
      };
      chip.addEventListener("pointerup", clear);
      chip.addEventListener("pointerleave", clear);
    }
    row.appendChild(lang);
    row.appendChild(cell);
    return row;
  }

  async function pick(dialectId) {
    if (mode === "ime") await Dox.prefs.setImeDialect(dialectId);
    else await Dox.prefs.setDefaultDialect(dialectId);
    const cb = onPick;
    close();
    if (cb) cb(dialectId, mode);
  }

  async function redraw() {
    if (!host) return;
    const prefs = await Dox.prefs.get();
    const body = host.querySelector(".dox-sheet-body");
    const cols = document.createElement("div");
    cols.className = "dox-sheet-cols";
    const addBlock = (title, ids, spokenLookup) => {
      if (!ids.length) return;
      const h = document.createElement("div");
      h.className = "dox-sheet-section";
      h.textContent = title;
      h.style.gridColumn = "1 / -1";
      cols.appendChild(h);
      ids.forEach((id) => {
        cols.appendChild(renderRow(prefs, id, spokenLookup(id), true));
      });
    };
    addBlock(t("dialect_favorites"), prefs.favorites, (id) => Dox.spokenIdOf(id));
    addBlock(t("dialect_recents"), prefs.recents, (id) => Dox.spokenIdOf(id));
    for (const group of visibleDialects(prefs)) {
      if (collapsed.has(group.id) && !search.trim()) {
        const g = document.createElement("div");
        g.className = "dox-sheet-group";
        g.textContent = "▸ " + Dox.locale.groupLabel(group.id);
        g.addEventListener("click", async () => {
          collapsed.delete(group.id);
          await redraw();
        });
        cols.appendChild(g);
        continue;
      }
      const g = document.createElement("div");
      g.className = "dox-sheet-group";
      g.textContent = "▾ " + Dox.locale.groupLabel(group.id);
      g.addEventListener("click", async () => {
        collapsed.add(group.id);
        await redraw();
      });
      cols.appendChild(g);
      for (const lang of group.languages) {
        lang.dialects.forEach((d, i) => {
          cols.appendChild(renderRow(prefs, d.id, lang.id, i === 0));
        });
      }
    }
    body.replaceChildren(cols);
  }

  function close() {
    closeHint();
    clearTimeout(hamaTimer);
    host?.remove();
    host = null;
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
    host = document.createElement("div");
    host.className = "dox-sheet-scrim";
    const sheet = document.createElement("div");
    sheet.className = "dox-sheet";
    Dox.locale.applyDir(sheet);
    const head = document.createElement("div");
    head.className = "dox-sheet-head";
    const input = document.createElement("input");
    input.className = "dox-sheet-search";
    input.placeholder = t("language_search_hint");
    input.addEventListener("input", async () => {
      search = input.value;
      await redraw();
    });
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "dox-sheet-close";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", close);
    head.append(input, closeBtn);
    const body = document.createElement("div");
    body.className = "dox-sheet-body";
    sheet.append(head, body);
    host.appendChild(sheet);
    host.addEventListener("click", (e) => {
      if (e.target === host) close();
      else if (hintPopup && !hintPopup.contains(e.target) && !e.target.classList.contains("dox-sheet-i")) {
        closeHint();
      }
    });
    document.documentElement.appendChild(host);
    document.addEventListener("keydown", onKey);
    await redraw();
    input.focus();
  }

  Dox.sheet = { open, close };
})();
