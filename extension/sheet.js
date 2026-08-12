/**
 * Dialex dialect sheet for Chrome (Favorites / Recents + Language | Dialect).
 * Prefs in chrome.storage.sync. Requires DialexCatalog.
 */
(function (global) {
  const FAV_KEY = "dialectFavorites";
  const RECENT_KEY = "dialectRecents";

  let mem = { favorites: [], recents: [] };
  let loaded = false;

  function loadPrefs(cb) {
    if (!global.chrome?.storage?.sync) {
      loaded = true;
      cb?.();
      return;
    }
    chrome.storage.sync.get(
      { [FAV_KEY]: [], [RECENT_KEY]: [] },
      (data) => {
        mem.favorites = data[FAV_KEY] || [];
        mem.recents = data[RECENT_KEY] || [];
        loaded = true;
        cb?.();
      }
    );
  }

  function persist() {
    if (!global.chrome?.storage?.sync) return;
    chrome.storage.sync.set({
      [FAV_KEY]: mem.favorites,
      [RECENT_KEY]: mem.recents,
    });
  }

  function toggleFavorite(dialectId) {
    const set = new Set(mem.favorites);
    if (set.has(dialectId)) set.delete(dialectId);
    else set.add(dialectId);
    mem.favorites = [...set];
    persist();
  }

  function pushRecent(dialectId) {
    mem.recents = [dialectId, ...mem.recents.filter((id) => id !== dialectId)].slice(0, 8);
    persist();
  }

  function ensureStyles() {
    if (document.getElementById("dialex-sheet-styles")) return;
    const style = document.createElement("style");
    style.id = "dialex-sheet-styles";
    style.textContent = `
      .dx-sheet-backdrop {
        position: fixed; inset: 0; z-index: 2147483000;
        background: rgba(0,0,0,0.62);
        display: flex; align-items: flex-end; justify-content: center;
        font-family: Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      @media (min-width: 720px) {
        .dx-sheet-backdrop { align-items: center; }
      }
      .dx-sheet {
        width: min(720px, 100%);
        max-height: min(86vh, 720px);
        background: #0a0a0b;
        border: 1px solid #1e1e22;
        border-radius: 20px 20px 0 0;
        color: #f2f4f7;
        display: flex; flex-direction: column;
        box-shadow: 0 -12px 48px rgba(0,0,0,0.55);
      }
      @media (min-width: 720px) {
        .dx-sheet { border-radius: 20px; }
      }
      .dx-sheet-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 16px 8px; border-bottom: 1px solid #1e1e22;
      }
      .dx-sheet-title { font-weight: 700; font-size: 16px; margin: 0; }
      .dx-sheet-close {
        background: transparent; border: none; color: #9ba3ae;
        font-size: 22px; cursor: pointer; line-height: 1;
      }
      .dx-sheet-pills {
        display: flex; gap: 8px; overflow-x: auto; padding: 10px 16px;
        border-bottom: 1px solid #1e1e22;
      }
      .dx-sheet-pill {
        flex: 0 0 auto; border: 1px solid #1e1e22; background: #141417;
        color: #f2f4f7; border-radius: 999px; padding: 6px 10px;
        font: inherit; font-size: 12px; cursor: pointer;
      }
      .dx-sheet-pill.active { border-color: #d1d7de; color: #fff; }
      .dx-sheet-search {
        margin: 10px 16px 0; width: calc(100% - 32px);
        background: #141417; border: 1px solid #1e1e22; border-radius: 10px;
        color: #f2f4f7; padding: 10px 12px; font: inherit; font-size: 14px;
      }
      .dx-sheet-body {
        flex: 1; min-height: 0; display: grid;
        grid-template-columns: 42% 58%; gap: 0; padding: 8px 0 12px;
      }
      .dx-sheet-col {
        overflow-y: auto; min-height: 220px; max-height: 52vh;
        padding: 0 8px;
      }
      .dx-sheet-col + .dx-sheet-col { border-left: 1px solid #1e1e22; }
      .dx-sheet-group {
        margin: 8px 4px 4px; font-size: 11px; font-weight: 700;
        letter-spacing: 0.04em; text-transform: uppercase; color: #9ba3ae;
        cursor: pointer; user-select: none;
      }
      .dx-sheet-row {
        display: flex; align-items: center; justify-content: space-between;
        gap: 8px; width: 100%; text-align: left;
        background: transparent; border: none; color: #f2f4f7;
        border-radius: 10px; padding: 10px 10px; font: inherit; font-size: 14px;
        cursor: pointer;
      }
      .dx-sheet-row:hover { background: #141417; }
      .dx-sheet-row.selected { background: rgba(209,215,222,0.12); }
      .dx-sheet-row .meta { color: #9ba3ae; font-size: 12px; }
      .dx-sheet-star {
        background: transparent; border: none; color: #9ba3ae;
        cursor: pointer; font-size: 16px; padding: 0 4px;
      }
      .dx-sheet-star.on { color: #d1d7de; }
      .dx-sheet-auto {
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px; padding: 10px 16px; border-bottom: 1px solid #1e1e22;
        font-size: 13px;
      }
      .dx-sheet-actions {
        display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 16px 14px;
        border-top: 1px solid #1e1e22;
      }
      .dx-sheet-actions button, .dx-sheet-actions a {
        border-radius: 999px; border: 1px solid #1e1e22; background: #141417;
        color: #f2f4f7; padding: 8px 12px; font: inherit; font-size: 13px;
        font-weight: 700; cursor: pointer; text-decoration: none;
      }
      .dx-sheet-actions button.primary {
        background: #f2f4f7; color: #000; border-color: #f2f4f7;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  /**
   * @param {object} opts
   * @param {string} opts.languageId
   * @param {string} opts.dialectId
   * @param {boolean} [opts.showAutoTranslate]
   * @param {boolean} [opts.autoTranslate]
   * @param {(v:boolean)=>void} [opts.onAutoTranslateChange]
   * @param {string} [opts.translateLabel]
   * @param {()=>void} [opts.onTranslate]
   * @param {string} [opts.padUrl]
   * @param {(next:{languageId:string,dialectId:string})=>void} opts.onSelect
   * @param {()=>void} [opts.onClose]
   */
  function openDialectSheet(opts) {
    const catalog = global.DialexCatalog;
    if (!catalog) return;

    const start = () => {
      ensureStyles();
      document.getElementById("dx-sheet-root")?.remove();

      let languageId =
        catalog.resolveLanguageId(opts.languageId) || catalog.DEFAULT_LANGUAGE;
      let dialectId =
        catalog.normalizeDialectId(opts.dialectId) || catalog.DEFAULT_DIALECT;
      let query = "";
      const collapsed = new Set();

      const root = document.createElement("div");
      root.id = "dx-sheet-root";
      root.className = "dx-sheet-backdrop";
      root.innerHTML = `
        <div class="dx-sheet" role="dialog" aria-modal="true" aria-label="Choose dialect">
          <div class="dx-sheet-header">
            <h2 class="dx-sheet-title">Choose dialect</h2>
            <button type="button" class="dx-sheet-close" aria-label="Close">×</button>
          </div>
          <div class="dx-sheet-auto" id="dx-sheet-auto" hidden></div>
          <div class="dx-sheet-pills" id="dx-sheet-pills"></div>
          <input class="dx-sheet-search" id="dx-sheet-search" placeholder="Search languages or dialects" />
          <div class="dx-sheet-body">
            <div class="dx-sheet-col" id="dx-sheet-langs"></div>
            <div class="dx-sheet-col" id="dx-sheet-dialects"></div>
          </div>
          <div class="dx-sheet-actions" id="dx-sheet-actions"></div>
        </div>
      `;
      document.documentElement.appendChild(root);

      const pillsEl = root.querySelector("#dx-sheet-pills");
      const langsEl = root.querySelector("#dx-sheet-langs");
      const dialectsEl = root.querySelector("#dx-sheet-dialects");
      const searchEl = root.querySelector("#dx-sheet-search");
      const autoEl = root.querySelector("#dx-sheet-auto");
      const actionsEl = root.querySelector("#dx-sheet-actions");

      if (opts.showAutoTranslate) {
        autoEl.hidden = false;
        autoEl.innerHTML = `<span><strong>Auto-Translate</strong></span>`;
        const sw = document.createElement("input");
        sw.type = "checkbox";
        sw.checked = opts.autoTranslate !== false;
        sw.addEventListener("change", () => opts.onAutoTranslateChange?.(sw.checked));
        autoEl.appendChild(sw);
      }

      if (opts.onTranslate || opts.padUrl) {
        if (opts.onTranslate) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "primary";
          btn.textContent = opts.translateLabel || "Translate";
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            opts.onSelect({ languageId, dialectId });
            pushRecent(dialectId);
            opts.onTranslate();
            close();
          });
          actionsEl.appendChild(btn);
        }
        if (opts.padUrl) {
          const a = document.createElement("a");
          a.href = opts.padUrl;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = "Open Dialex Pad";
          a.addEventListener("click", (e) => e.stopPropagation());
          actionsEl.appendChild(a);
        }
      } else {
        actionsEl.hidden = true;
      }

      function close() {
        root.remove();
        opts.onClose?.();
      }

      function applySelect(id, closeAfter) {
        const d = catalog.dialectById(id);
        if (!d) return;
        dialectId = d.id;
        languageId = d.languageId;
        pushRecent(dialectId);
        opts.onSelect({ languageId, dialectId });
        if (closeAfter) close();
        else {
          renderPills();
          renderLangs();
          renderDialects();
        }
      }

      function renderPills() {
        pillsEl.innerHTML = "";
        const favs = mem.favorites.map((id) => catalog.dialectById(id)).filter(Boolean);
        const recents = mem.recents.map((id) => catalog.dialectById(id)).filter(Boolean);
        [...favs.map((d) => ({ d, star: true })), ...recents.map((d) => ({ d, star: false }))].forEach(
          ({ d, star }) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "dx-sheet-pill" + (d.id === dialectId ? " active" : "");
            btn.textContent = (star ? "★ " : "") + d.name;
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              applySelect(d.id, true);
            });
            pillsEl.appendChild(btn);
          }
        );
        pillsEl.hidden = !pillsEl.children.length;
      }

      function renderLangs() {
        langsEl.innerHTML = "";
        const q = query.trim().toLowerCase();
        catalog.groups.forEach((group) => {
          let langs = catalog.languagesForGroup(group.id);
          if (q) {
            langs = langs.filter(
              (l) =>
                l.name.toLowerCase().includes(q) ||
                catalog.dialectsFor(l.id).some((d) => d.name.toLowerCase().includes(q))
            );
          }
          if (!langs.length) return;
          const gh = document.createElement("div");
          gh.className = "dx-sheet-group";
          const open = !collapsed.has(group.id);
          gh.textContent = `${open ? "▾" : "▸"} ${group.name}`;
          gh.addEventListener("click", (e) => {
            e.stopPropagation();
            if (collapsed.has(group.id)) collapsed.delete(group.id);
            else collapsed.add(group.id);
            renderLangs();
          });
          langsEl.appendChild(gh);
          if (!open) return;
          langs.forEach((lang) => {
            const row = document.createElement("button");
            row.type = "button";
            row.className = "dx-sheet-row" + (lang.id === languageId ? " selected" : "");
            row.textContent = lang.name;
            row.addEventListener("click", (e) => {
              e.stopPropagation();
              languageId = lang.id;
              const def = catalog.defaultDialectFor(languageId);
              if (def) dialectId = def.id;
              opts.onSelect({ languageId, dialectId });
              renderLangs();
              renderDialects();
            });
            langsEl.appendChild(row);
          });
        });
      }

      function renderDialects() {
        dialectsEl.innerHTML = "";
        const q = query.trim().toLowerCase();
        let list = catalog.dialectsFor(languageId);
        if (q) list = list.filter((d) => d.name.toLowerCase().includes(q));
        const favs = new Set(mem.favorites);
        list.forEach((d) => {
          const wrap = document.createElement("div");
          wrap.style.display = "flex";
          wrap.style.alignItems = "center";
          const row = document.createElement("button");
          row.type = "button";
          row.className = "dx-sheet-row" + (d.id === dialectId ? " selected" : "");
          row.style.flex = "1";
          row.innerHTML =
            `<span>${d.name}</span>` +
            (d.id === dialectId ? '<span class="meta">✓</span>' : "");
          row.addEventListener("click", (e) => {
            e.stopPropagation();
            applySelect(d.id, !opts.onTranslate);
          });
          const star = document.createElement("button");
          star.type = "button";
          star.className = "dx-sheet-star" + (favs.has(d.id) ? " on" : "");
          star.textContent = favs.has(d.id) ? "★" : "☆";
          star.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleFavorite(d.id);
            renderPills();
            renderDialects();
          });
          wrap.appendChild(row);
          wrap.appendChild(star);
          dialectsEl.appendChild(wrap);
        });
      }

      root.querySelector(".dx-sheet-close").addEventListener("click", (e) => {
        e.stopPropagation();
        close();
      });
      root.addEventListener("click", (e) => {
        if (e.target === root) close();
      });
      root.querySelector(".dx-sheet").addEventListener("click", (e) => e.stopPropagation());
      searchEl.addEventListener("input", () => {
        query = searchEl.value;
        renderLangs();
        renderDialects();
      });

      renderPills();
      renderLangs();
      renderDialects();
    };

    if (!loaded) loadPrefs(start);
    else start();
  }

  loadPrefs();

  global.DialexSheet = {
    openDialectSheet,
    pushRecent,
    toggleFavorite,
    loadPrefs,
  };
})(typeof window !== "undefined" ? window : globalThis);
