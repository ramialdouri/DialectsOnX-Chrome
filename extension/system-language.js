/* Dialex System Language list: flat 58 spoken rows, endonym + localized name, no gold headers. */
globalThis.Dox = globalThis.Dox || {};

(function () {
  if (Dox.systemLanguage) return;

  function injectStyles() {
    if (document.getElementById("dox-sys-styles")) return;
    const style = document.createElement("style");
    style.id = "dox-sys-styles";
    style.textContent = `
      .dox-sys {
        display: flex; flex-direction: column;
        box-sizing: border-box;
        height: 100vh;
        max-width: 720px;
        margin: 0 auto;
        padding: 8px 24px 24px;
        font-family: var(--dox-font, ${Dox.FONT});
        color: var(--dox-text, #F4F4F5);
        background: var(--dox-ink, #000000);
      }
      .dox-sys.hidden { display: none; }
      .dox-sys-header {
        display: flex; align-items: center;
        flex-shrink: 0;
        padding: 4px 0;
        gap: 12px;
      }
      .dox-sys-back {
        width: 44px; height: 44px; flex-shrink: 0;
        background: none; border: 0; color: var(--dox-text, #F4F4F5);
        cursor: pointer; padding: 0;
        display: inline-flex; align-items: center; justify-content: center;
      }
      .dox-sys-back svg { width: 24px; height: 24px; display: block; }
      .dox-sys-title {
        margin: 0;
        font-size: 28px; font-weight: 500; line-height: 1.2;
      }
      .dox-sys-card {
        flex: 1; min-height: 0;
        margin-top: 17px;
        display: flex; flex-direction: column;
        background: var(--dox-panel, #151518);
        border: 1px solid var(--dox-line, #2C2C31);
        border-radius: 12px;
        overflow: hidden;
      }
      .dox-sys-search-row {
        flex-shrink: 0;
        padding: 8px;
      }
      .dox-sys-search {
        display: flex; align-items: center; gap: 4px;
        height: 36px;
        box-sizing: border-box;
        background: var(--dox-field, #1C1C1F);
        border: 1px solid var(--dox-line, #2C2C31);
        border-radius: 8px;
        padding: 0 4px 0 10px;
      }
      .dox-sys-search:focus-within { border-color: var(--dox-accent); }
      .dox-sys-search-icon {
        color: var(--dox-muted, #8E8E93); flex-shrink: 0;
        width: 16px; height: 16px; display: inline-flex;
      }
      .dox-sys-search-icon svg { width: 16px; height: 16px; display: block; }
      .dox-sys-search input {
        flex: 1; min-width: 0;
        background: transparent; border: 0; color: var(--dox-text, #F4F4F5);
        font: 600 13px var(--dox-font, ${Dox.FONT}); outline: none;
      }
      .dox-sys-search input::placeholder { color: var(--dox-muted, #8E8E93); font-weight: 600; }
      .dox-sys-search-clear {
        width: 36px; height: 36px; flex-shrink: 0;
        background: none; border: 0; color: var(--dox-muted, #8E8E93); cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center;
        padding: 0;
      }
      .dox-sys-search-clear svg { width: 16px; height: 16px; display: block; }
      .dox-sys-list {
        flex: 1; min-height: 0;
        overflow: auto;
        padding: 6px 0;
      }
      .sys-row {
        display: flex; align-items: center;
        width: 100%;
        box-sizing: border-box;
        padding: 6px 16px;
        cursor: pointer;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        text-align: start;
      }
      .sys-row:hover .sys-endonym { color: var(--dox-text, #F4F4F5); }
      .sys-row-text {
        flex: 1; min-width: 0;
        display: flex; align-items: center;
      }
      .sys-endonym {
        font-weight: 600; font-size: 13px;
        color: var(--dox-muted, #8E8E93);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        flex: 0 1 auto;
        max-width: 100%;
      }
      .sys-row.selected .sys-endonym { color: var(--dox-text, #F4F4F5); }
      .sys-en {
        font-weight: 500; font-size: 12px;
        color: var(--dox-muted, #8E8E93);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        flex: 1 1 0;
        margin-inline-start: 8px;
        min-width: 0;
      }
      .sys-check {
        width: 16px; height: 16px; flex-shrink: 0;
        color: var(--dox-accent);
        margin-inline-start: 8px;
        display: inline-flex; align-items: center; justify-content: center;
      }
      .sys-check svg { width: 16px; height: 16px; display: block; }
    `;
    document.documentElement.appendChild(style);
  }

  function matches(lang, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return true;
    const endonym = Dox.locale.endonym(lang.id);
    const label = Dox.locale.languageLabel(lang.id);
    const abbrev = Dox.locale.languageAbbrev(lang.id);
    return (
      endonym.toLowerCase().includes(q) ||
      label.toLowerCase().includes(q) ||
      lang.id.toLowerCase().includes(q) ||
      (abbrev && abbrev.toLowerCase().includes(q))
    );
  }

  function decorateSearch(root) {
    const icon = root.querySelector(".dox-sys-search-icon");
    if (icon && !icon.querySelector("svg") && Dox.icon) {
      icon.replaceChildren(Dox.icon("search", 16));
    }
    const clear = root.querySelector(".dox-sys-search-clear");
    if (clear && !clear.querySelector("svg") && Dox.icon) {
      clear.replaceChildren(Dox.icon("close", 16));
    }
    const back = root.querySelector(".dox-sys-back");
    if (back && Dox.icon) {
      back.replaceChildren(Dox.icon("back", 24));
    }
  }

  function renderList(listEl, query, selectedId, onSelect) {
    injectStyles();
    decorateSearch(listEl.closest(".dox-sys") || document);
    listEl.replaceChildren();
    for (const group of Dox.CATALOG.groups) {
      for (const lang of group.languages) {
        if (!matches(lang, query)) continue;
        const endonym = Dox.locale.endonym(lang.id);
        const label = Dox.locale.languageLabel(lang.id);
        const selected = lang.id === selectedId;
        const row = document.createElement("button");
        row.type = "button";
        row.className = "sys-row" + (selected ? " selected" : "");
        row.dataset.spokenId = lang.id;
        const text = document.createElement("span");
        text.className = "sys-row-text";
        const left = document.createElement("span");
        left.className = "sys-endonym";
        left.textContent = endonym;
        text.appendChild(left);
        if (label && label !== endonym) {
          const right = document.createElement("span");
          right.className = "sys-en";
          right.textContent = label;
          text.appendChild(right);
        }
        row.appendChild(text);
        if (selected) {
          const check = document.createElement("span");
          check.className = "sys-check";
          check.appendChild(Dox.icon("check", 16));
          row.appendChild(check);
        }
        row.addEventListener("click", () => onSelect(lang.id));
        listEl.appendChild(row);
      }
    }
  }

  Dox.systemLanguage = { injectStyles, matches, renderList };
})();
