/**
 * Dialex dialect sheet: Favorites / Recents, Language | Dialect columns.
 * Mirrors Android DialectCatalogSheet on main @ 112b2ec.
 * English has no group header; the English row shows a Germanic badge.
 * Sheet fills the viewport. Storage: chrome.storage.sync, else localStorage.
 */
(function (global) {
  const LS_KEY = "dialex_sheet_prefs";
  const FAV_KEY = "dialectFavorites";
  const RECENT_KEY = "dialectRecents";
  const MAX_FAV = 12;
  const MAX_RECENT = 8;

  const isExt = Boolean(global.chrome?.storage?.sync);
  let mem = { favorites: [], recents: [] };
  let loaded = !isExt;
  let unlockBody = null;

  function loadLocal() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
      mem.favorites = raw.favorites || [];
      mem.recents = raw.recents || [];
    } catch {
      mem = { favorites: [], recents: [] };
    }
    loaded = true;
  }

  function persistLocal() {
    localStorage.setItem(LS_KEY, JSON.stringify(mem));
  }

  function loadPrefs(cb) {
    if (!isExt) {
      loadLocal();
      cb?.();
      return;
    }
    chrome.storage.sync.get({ [FAV_KEY]: [], [RECENT_KEY]: [] }, (data) => {
      mem.favorites = data[FAV_KEY] || [];
      mem.recents = data[RECENT_KEY] || [];
      loaded = true;
      cb?.();
    });
  }

  function persist() {
    if (!isExt) {
      persistLocal();
      return;
    }
    chrome.storage.sync.set({
      [FAV_KEY]: mem.favorites,
      [RECENT_KEY]: mem.recents,
    });
  }

  function toggleFavorite(dialectId) {
    const set = new Set(mem.favorites);
    if (set.has(dialectId)) set.delete(dialectId);
    else {
      set.add(dialectId);
      mem.favorites = [...set].slice(0, MAX_FAV);
      persist();
      return;
    }
    mem.favorites = [...set];
    persist();
  }

  function pushRecent(dialectId) {
    mem.recents = [dialectId, ...mem.recents.filter((id) => id !== dialectId)].slice(
      0,
      MAX_RECENT
    );
    persist();
  }

  function lockBody() {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html && html.style.overflow;
    const prevBody = body && body.style.overflow;
    if (html) html.style.overflow = "hidden";
    if (body) body.style.overflow = "hidden";
    unlockBody = () => {
      if (html) html.style.overflow = prevHtml || "";
      if (body) body.style.overflow = prevBody || "";
      unlockBody = null;
    };
  }

  function ensureFont() {
    if (document.getElementById("dialex-manrope")) return;
    const link = document.createElement("link");
    link.id = "dialex-manrope";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap";
    (document.head || document.documentElement).appendChild(link);
  }

  function ensureStyles() {
    if (document.getElementById("dialex-sheet-styles")) return;
    const style = document.createElement("style");
    style.id = "dialex-sheet-styles";
    style.textContent = `
      .dx-sheet-backdrop {
        position: fixed; inset: 0; z-index: 2147483000;
        background: #000;
        display: flex; flex-direction: column;
        font-family: Manrope, system-ui, sans-serif;
        color: #f2f4f7;
        overscroll-behavior: none;
      }
      .dx-sheet {
        flex: 1; min-height: 0;
        width: 100%; height: 100dvh; height: 100vh;
        background: #0a0a0b;
        border: 0;
        display: flex; flex-direction: column;
        color: #f2f4f7;
      }
      .dx-sheet-header {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        padding: 14px 18px 12px;
        border-bottom: 1px solid #1e1e22;
        flex: 0 0 auto;
      }
      .dx-sheet-brand {
        font-weight: 700; letter-spacing: 0.28em; font-size: 11px;
        text-transform: uppercase; color: #d1d7de;
      }
      .dx-sheet-title {
        font-weight: 600; font-size: 16px; margin: 0; text-align: center;
        letter-spacing: -0.02em;
      }
      .dx-sheet-close {
        justify-self: end;
        width: 32px; height: 32px; border-radius: 999px;
        background: transparent; border: 1px solid #1e1e22; color: #9ba3ae;
        font-size: 18px; cursor: pointer; line-height: 1;
      }
      .dx-sheet-close:hover { border-color: #d1d7de; color: #f2f4f7; }
      .dx-sheet-quick {
        display: flex; flex-direction: column; gap: 8px;
        padding: 10px 18px; border-bottom: 1px solid #1e1e22;
        flex: 0 0 auto;
      }
      .dx-sheet-quick[hidden] { display: none; }
      .dx-sheet-quick-row { display: flex; align-items: center; gap: 8px; overflow-x: auto; }
      .dx-sheet-quick-label {
        flex: 0 0 auto; font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
        text-transform: uppercase; color: #9ba3ae;
      }
      .dx-sheet-pill {
        flex: 0 0 auto; border: 1px solid #1e1e22; background: transparent;
        color: #f2f4f7; border-radius: 999px; padding: 6px 12px;
        font: inherit; font-size: 12px; cursor: pointer;
      }
      .dx-sheet-pill.active { border-color: #d1d7de; background: #141417; }
      .dx-sheet-auto {
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px; padding: 10px 18px; border-bottom: 1px solid #1e1e22;
        font-size: 13px; flex: 0 0 auto;
      }
      .dx-sheet-body {
        flex: 1; min-height: 0; display: grid;
        grid-template-columns: 45% 55%;
      }
      .dx-sheet-col {
        min-height: 0; overflow-y: auto; padding: 8px 10px 16px;
        overscroll-behavior: contain;
      }
      .dx-sheet-col + .dx-sheet-col { border-left: 1px solid #1e1e22; }
      .dx-sheet-search-wrap {
        padding: 4px 6px 10px; position: sticky; top: 0; background: #0a0a0b; z-index: 1;
        display: flex; align-items: center; gap: 8px;
      }
      .dx-sheet-search-icon { color: #9ba3ae; flex: 0 0 auto; }
      .dx-sheet-search {
        flex: 1; min-width: 0; box-sizing: border-box;
        background: #141417; border: 1px solid #1e1e22; border-radius: 999px;
        color: #f2f4f7; padding: 10px 14px; font: inherit; font-size: 14px;
      }
      .dx-sheet-search:focus { outline: none; border-color: #d1d7de; }
      .dx-sheet-search-clear {
        flex: 0 0 auto; width: 28px; height: 28px; border-radius: 999px;
        border: 0; background: transparent; color: #9ba3ae; cursor: pointer;
        font-size: 16px; line-height: 1;
      }
      .dx-sheet-search-clear[hidden] { display: none; }
      .dx-sheet-empty {
        padding: 12px 10px; color: #9ba3ae; font-size: 13px;
      }
      .dx-sheet-group {
        margin: 10px 6px 4px; font-size: 11px; font-weight: 700;
        letter-spacing: 0.1em; text-transform: uppercase; color: #9ba3ae;
        cursor: pointer; user-select: none; display: flex; align-items: center; gap: 8px;
      }
      .dx-sheet-group .chev { font-size: 10px; opacity: 0.8; }
      .dx-sheet-row {
        display: flex; align-items: center; justify-content: space-between;
        gap: 8px; width: 100%; text-align: left;
        background: transparent; border: none; color: #f2f4f7;
        border-radius: 10px; padding: 10px 10px; font: inherit; font-size: 14px;
        cursor: pointer;
      }
      .dx-sheet-row:hover { background: #141417; }
      .dx-sheet-row.selected {
        background: rgba(209,215,222,0.1);
        box-shadow: inset 0 0 0 1px #1e1e22;
      }
      .dx-sheet-row.hit { color: #f2f4f7; }
      .dx-sheet-row .meta { color: #9ba3ae; font-size: 12px; }
      .dx-sheet-row .hits { display: block; font-size: 11px; color: #9ba3ae; margin-top: 2px; }
      .dx-sheet-badge {
        font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
        color: #d1d7de; border: 1px solid #1e1e22; background: rgba(242,244,247,0.08);
        border-radius: 999px; padding: 3px 7px;
      }
      .dx-sheet-dialect-head {
        position: sticky; top: 0; background: #0a0a0b; z-index: 1;
        padding: 10px 12px 12px; border-bottom: 1px solid #1e1e22; margin-bottom: 8px;
      }
      .dx-sheet-dialect-head .lang { font-size: 22px; font-weight: 700; letter-spacing: -0.03em; }
      .dx-sheet-dialect-head .dia { font-size: 13px; color: #9ba3ae; margin-top: 4px; }
      .dx-dialect-card {
        display: flex; align-items: center; gap: 6px;
        margin: 0 4px 6px; padding: 2px;
        border: 1px solid #1e1e22; border-radius: 12px; background: #141417;
      }
      .dx-dialect-card.selected { border-color: #d1d7de; }
      .dx-sheet-star, .dx-sheet-info {
        background: transparent; border: none; color: #9ba3ae;
        cursor: pointer; font-size: 15px; padding: 0 6px; line-height: 1;
      }
      .dx-sheet-star.on { color: #d1d7de; }
      .dx-sheet-info {
        width: 18px; height: 18px; border-radius: 999px; border: 1px solid #1e1e22;
        font-size: 11px; font-weight: 700; color: #9ba3ae;
      }
      .dx-city-hint {
        position: fixed; z-index: 2147483001;
        background: #141417; border: 1px solid #1e1e22; color: #f2f4f7;
        border-radius: 8px; padding: 6px 10px; font-size: 12px;
        font-family: Manrope, system-ui, sans-serif;
        box-shadow: 0 8px 24px rgba(0,0,0,0.45); pointer-events: none;
        max-width: 280px;
      }
      .dx-sheet-actions {
        display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 16px 14px;
        border-top: 1px solid #1e1e22; flex: 0 0 auto;
      }
      .dx-sheet-actions button, .dx-sheet-actions a {
        border-radius: 999px; border: 1px solid #1e1e22; background: #141417;
        color: #f2f4f7; padding: 8px 12px; font: inherit; font-size: 13px;
        font-weight: 700; cursor: pointer; text-decoration: none;
      }
      .dx-sheet-actions button.primary {
        background: #f2f4f7; color: #000; border-color: #f2f4f7;
      }
      @media (max-width: 640px) {
        .dx-sheet-body { grid-template-columns: 45% 55%; }
        .dx-sheet-brand { letter-spacing: 0.18em; font-size: 10px; }
        .dx-sheet-dialect-head .lang { font-size: 18px; }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function openDialectSheet(opts) {
    const catalog = global.DialexCatalog;
    if (!catalog) return;

    const start = () => {
      ensureFont();
      ensureStyles();
      document.getElementById("dx-sheet-root")?.remove();
      document.querySelector(".dx-city-hint")?.remove();
      unlockBody?.();
      lockBody();

      let languageId =
        catalog.resolveLanguageId(opts.languageId) || catalog.DEFAULT_LANGUAGE;
      let dialectId =
        catalog.normalizeDialectId(opts.dialectId) || catalog.DEFAULT_DIALECT;
      let query = "";
      const collapsed = new Set();
      const germanic = catalog.germanicGroupName();

      const root = document.createElement("div");
      root.id = "dx-sheet-root";
      root.className = "dx-sheet-backdrop";
      root.innerHTML = `
        <div class="dx-sheet" role="dialog" aria-modal="true" aria-label="Select a dialect">
          <div class="dx-sheet-header">
            <div class="dx-sheet-brand">Dialex</div>
            <h2 class="dx-sheet-title">Select a dialect</h2>
            <button type="button" class="dx-sheet-close" aria-label="Close">×</button>
          </div>
          <div class="dx-sheet-auto" id="dx-sheet-auto" hidden></div>
          <div class="dx-sheet-quick" id="dx-sheet-quick" hidden></div>
          <div class="dx-sheet-body">
            <div class="dx-sheet-col" id="dx-sheet-langs">
              <div class="dx-sheet-search-wrap">
                <input class="dx-sheet-search" id="dx-sheet-search" placeholder="Search languages or dialects" aria-label="Search languages or dialects" />
                <button type="button" class="dx-sheet-search-clear" id="dx-sheet-search-clear" hidden aria-label="Clear search">×</button>
              </div>
              <div id="dx-sheet-lang-list"></div>
            </div>
            <div class="dx-sheet-col" id="dx-sheet-dialects"></div>
          </div>
          <div class="dx-sheet-actions" id="dx-sheet-actions"></div>
        </div>
      `;
      (document.body || document.documentElement).appendChild(root);

      const quickEl = root.querySelector("#dx-sheet-quick");
      const langsList = root.querySelector("#dx-sheet-lang-list");
      const dialectsEl = root.querySelector("#dx-sheet-dialects");
      const searchEl = root.querySelector("#dx-sheet-search");
      const searchClear = root.querySelector("#dx-sheet-search-clear");
      const autoEl = root.querySelector("#dx-sheet-auto");
      const actionsEl = root.querySelector("#dx-sheet-actions");
      const closeBtn = root.querySelector(".dx-sheet-close");

      if (opts.showAutoTranslate) {
        autoEl.hidden = false;
        const label = document.createElement("span");
        label.innerHTML = "<strong>Auto-translate</strong>";
        const sw = document.createElement("input");
        sw.type = "checkbox";
        sw.checked = opts.autoTranslate !== false;
        sw.addEventListener("change", () => opts.onAutoTranslateChange?.(sw.checked));
        autoEl.appendChild(label);
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
            opts.onSelect({ languageId, dialectId, complete: true });
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

      function hideHint() {
        document.querySelector(".dx-city-hint")?.remove();
      }

      function close() {
        hideHint();
        unlockBody?.();
        root.remove();
        document.removeEventListener("keydown", onKey);
        opts.onClose?.();
      }

      function applySelect(id, closeAfter) {
        const d = catalog.dialectById(id);
        if (!d) return;
        dialectId = d.id;
        languageId = d.languageId;
        pushRecent(dialectId);
        opts.onSelect({ languageId, dialectId, complete: Boolean(closeAfter) });
        if (closeAfter) close();
        else {
          renderQuick();
          renderLangs();
          renderDialects();
        }
      }

      function langMatches(lang, q) {
        if (!q) return { ok: true, dialectHits: [] };
        const nameHit = lang.name.toLowerCase().includes(q);
        const group = catalog.groups.find((g) => g.id === lang.groupId);
        const groupHit = group && group.name.toLowerCase().includes(q);
        const badgeHit =
          lang.id === "english" && germanic.toLowerCase().includes(q);
        const dialectHits = catalog
          .dialectsFor(lang.id)
          .filter((d) => d.name.toLowerCase().includes(q));
        const ok = nameHit || groupHit || badgeHit || dialectHits.length > 0;
        return {
          ok,
          nameHit: nameHit || groupHit || badgeHit,
          dialectHits: nameHit || groupHit || badgeHit ? [] : dialectHits.slice(0, 2),
        };
      }

      function renderQuick() {
        quickEl.innerHTML = "";
        const favs = mem.favorites
          .map((id) => catalog.dialectById(id))
          .filter(Boolean)
          .slice(0, MAX_FAV);
        const recents = mem.recents
          .filter((id) => id !== dialectId)
          .map((id) => catalog.dialectById(id))
          .filter(Boolean)
          .slice(0, MAX_RECENT);
        const sections = [
          ["Favorites", favs],
          ["Recents", recents],
        ];
        let any = false;
        sections.forEach(([label, list]) => {
          if (!list.length) return;
          any = true;
          const row = document.createElement("div");
          row.className = "dx-sheet-quick-row";
          const lab = document.createElement("span");
          lab.className = "dx-sheet-quick-label";
          lab.textContent = label;
          row.appendChild(lab);
          list.forEach((d) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "dx-sheet-pill" + (d.id === dialectId ? " active" : "");
            btn.textContent = (label === "Favorites" ? "★ " : "") + d.name;
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              applySelect(d.id, true);
            });
            row.appendChild(btn);
          });
          quickEl.appendChild(row);
        });
        quickEl.hidden = !any;
      }

      function renderLangs() {
        langsList.innerHTML = "";
        const q = query.trim().toLowerCase();
        searchClear.hidden = !query.trim();
        let shown = 0;
        catalog.groups.forEach((group) => {
          const hits = catalog.languagesForGroup(group.id).map((lang) => {
            const m = langMatches(lang, q);
            return m.ok ? { lang, dialectHits: m.dialectHits, nameHit: m.nameHit } : null;
          }).filter(Boolean);
          if (!hits.length) return;
          const isHeaderless = group.id === "en";
          const open = q || isHeaderless || !collapsed.has(group.id);
          if (!isHeaderless) {
            const gh = document.createElement("div");
            gh.className = "dx-sheet-group";
            const chev = document.createElement("span");
            chev.className = "chev";
            chev.textContent = open ? "▾" : "▸";
            gh.appendChild(chev);
            gh.appendChild(document.createTextNode(group.name));
            gh.addEventListener("click", (e) => {
              e.stopPropagation();
              if (q) return;
              if (collapsed.has(group.id)) collapsed.delete(group.id);
              else collapsed.add(group.id);
              renderLangs();
            });
            langsList.appendChild(gh);
          }
          if (!open) return;
          hits.forEach(({ lang, dialectHits }) => {
            shown += 1;
            const row = document.createElement("button");
            row.type = "button";
            row.className = "dx-sheet-row" + (lang.id === languageId ? " selected" : "");
            const left = document.createElement("span");
            const name = document.createElement("span");
            name.textContent = lang.name;
            left.appendChild(name);
            if (dialectHits.length) {
              const sub = document.createElement("span");
              sub.className = "hits";
              sub.textContent = dialectHits.map((d) => d.name).join(" · ");
              left.appendChild(sub);
            }
            row.appendChild(left);
            if (lang.id === "english") {
              const badge = document.createElement("span");
              badge.className = "dx-sheet-badge";
              badge.textContent = germanic;
              row.appendChild(badge);
            } else if (lang.id === languageId) {
              const mark = document.createElement("span");
              mark.className = "meta";
              mark.textContent = "●";
              row.appendChild(mark);
            }
            row.addEventListener("click", (e) => {
              e.stopPropagation();
              languageId = lang.id;
              const def = catalog.defaultDialectFor(languageId);
              if (def) dialectId = def.id;
              opts.onSelect({ languageId, dialectId, complete: false });
              if (!dialectHits.length) {
                query = "";
                searchEl.value = "";
              }
              renderQuick();
              renderLangs();
              renderDialects();
            });
            langsList.appendChild(row);
          });
        });
        if (!shown) {
          const empty = document.createElement("div");
          empty.className = "dx-sheet-empty";
          empty.textContent = "No matches";
          langsList.appendChild(empty);
        }
      }

      function renderDialects() {
        hideHint();
        dialectsEl.innerHTML = "";
        const lang = catalog.languageById(languageId);
        const current = catalog.dialectById(dialectId);
        const head = document.createElement("div");
        head.className = "dx-sheet-dialect-head";
        const langEl = document.createElement("div");
        langEl.className = "lang";
        langEl.textContent = (lang?.name || "").replace(/ Cluster$/, "");
        const diaEl = document.createElement("div");
        diaEl.className = "dia";
        diaEl.textContent =
          current && current.languageId === languageId ? current.name : "";
        head.appendChild(langEl);
        head.appendChild(diaEl);
        dialectsEl.appendChild(head);

        const q = query.trim().toLowerCase();
        const list = catalog.dialectsFor(languageId);
        const favs = new Set(mem.favorites);
        list.forEach((d) => {
          const wrap = document.createElement("div");
          wrap.className = "dx-dialect-card" + (d.id === dialectId ? " selected" : "");
          const row = document.createElement("button");
          row.type = "button";
          row.className =
            "dx-sheet-row" +
            (d.id === dialectId ? " selected" : "") +
            (q && d.name.toLowerCase().includes(q) ? " hit" : "");
          row.style.flex = "1";
          const nameWrap = document.createElement("span");
          const name = document.createElement("span");
          name.textContent = d.name;
          nameWrap.appendChild(name);
          if (d.description) {
            const sub = document.createElement("span");
            sub.className = "hits";
            sub.textContent = d.description;
            nameWrap.appendChild(sub);
          }
          row.appendChild(nameWrap);
          if (d.id === dialectId) {
            const mark = document.createElement("span");
            mark.className = "meta";
            mark.textContent = "✓";
            row.appendChild(mark);
          }
          row.addEventListener("click", (e) => {
            e.stopPropagation();
            applySelect(d.id, !opts.onTranslate);
          });
          wrap.appendChild(row);
          if (d.description) {
            const info = document.createElement("button");
            info.type = "button";
            info.className = "dx-sheet-info";
            info.textContent = "i";
            info.setAttribute("aria-label", "About " + d.name);
            info.addEventListener("click", (e) => {
              e.stopPropagation();
              hideHint();
              const hint = document.createElement("div");
              hint.className = "dx-city-hint";
              hint.textContent = d.description;
              document.body.appendChild(hint);
              const r = info.getBoundingClientRect();
              hint.style.top = Math.max(8, r.bottom + 6) + "px";
              hint.style.left = Math.max(8, r.left - 40) + "px";
              setTimeout(hideHint, 2800);
            });
            wrap.appendChild(info);
          }
          const star = document.createElement("button");
          star.type = "button";
          star.className = "dx-sheet-star" + (favs.has(d.id) ? " on" : "");
          star.textContent = favs.has(d.id) ? "★" : "☆";
          star.title = favs.has(d.id) ? "Remove from favorites" : "Add to favorites";
          star.setAttribute(
            "aria-label",
            favs.has(d.id) ? "Remove " + d.name + " from favorites" : "Add " + d.name + " to favorites"
          );
          star.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleFavorite(d.id);
            renderQuick();
            renderDialects();
          });
          wrap.appendChild(star);
          dialectsEl.appendChild(wrap);
        });
      }

      function onKey(e) {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
      }

      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        close();
      });
      searchEl.addEventListener("input", () => {
        query = searchEl.value;
        renderLangs();
        renderDialects();
      });
      searchClear.addEventListener("click", (e) => {
        e.stopPropagation();
        query = "";
        searchEl.value = "";
        renderLangs();
        renderDialects();
        searchEl.focus();
      });
      document.addEventListener("keydown", onKey);
      searchEl.focus();

      renderQuick();
      renderLangs();
      renderDialects();
    };

    if (!loaded) loadPrefs(start);
    else start();
  }

  if (isExt) loadPrefs();
  else loadLocal();

  global.DialexSheet = {
    openDialectSheet,
    pushRecent,
    toggleFavorite,
    getFavorites: () => mem.favorites.slice(),
    getRecents: () => mem.recents.slice(),
    loadPrefs,
  };
})(typeof window !== "undefined" ? window : globalThis);
