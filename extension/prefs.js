/* DialectsOnX prefs. Unset autoTranslate is off; stored true is kept. */
globalThis.Dox = globalThis.Dox || {};

(function () {
  if (Dox.prefs) return;
  const CLOUD_RUN =
    "https://dialex-backend-f6b7-1086119311146.europe-west3.run.app";
  const DEFAULTS = {
    preferredDialect: "arabic_msa",
    autoTranslate: false,
    fawEnabled: true,
    newsToMsa: true,
    addressee: "masculine",
    extensionEnabled: true,
    imeEnabled: true,
    imeCollapsed: false,
    imeRememberPosition: true,
    imeDialect: "arabic_msa",
    backendUrl: CLOUD_RUN,
    favorites: [],
    recents: [],
    hamaUnlocked: false,
    systemDialectId: "",
    systemLanguageId: "",
  };

  function normalizeBackendUrl(url) {
    return String(url || "").trim().replace(/\/+$/, "") || CLOUD_RUN;
  }

  function migrateDialect(id) {
    return Dox.migrateDialectId(id);
  }

  function clipList(list, max) {
    const out = [];
    const seen = new Set();
    for (const raw of Array.isArray(list) ? list : []) {
      const id = migrateDialect(raw);
      if (!Dox.isValidDialect(id) || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      if (out.length >= max) break;
    }
    return out;
  }

  function osLanguageTag() {
    try {
      if (typeof chrome !== "undefined" && chrome.i18n && typeof chrome.i18n.getUILanguage === "function") {
        const ui = chrome.i18n.getUILanguage();
        if (ui) return ui;
      }
    } catch (_) {
      /* ignore */
    }
    if (typeof navigator !== "undefined") {
      const fromNav =
        navigator.language ||
        navigator.userLanguage ||
        (Array.isArray(navigator.languages) && navigator.languages[0]);
      if (fromNav) return fromNav;
    }
    return "en";
  }

  async function approvedSystemDialect(dialectId) {
    const spoken = Dox.spokenIdOf(dialectId);
    const standard = spoken ? Dox.standardDialectFor(spoken) : "english_american";
    try {
      const url = chrome.runtime.getURL("i18n/" + standard + ".json");
      const res = await fetch(url);
      if (!res.ok) return "english_american";
      const pack = await res.json();
      if (pack.status !== "approved") return "english_american";
      return standard;
    } catch (_) {
      return "english_american";
    }
  }

  async function ensureSystemLanguage(data) {
    if (data.systemDialectId && Dox.isValidDialect(data.systemDialectId)) {
      return data;
    }
    const dialectId = await approvedSystemDialect(Dox.dialectFromOsLocale(osLanguageTag()));
    const spoken = Dox.spokenIdOf(dialectId) || "english";
    data.systemDialectId = dialectId;
    data.systemLanguageId = spoken;
    await chrome.storage.sync.set({
      systemDialectId: dialectId,
      systemLanguageId: spoken,
    });
    return data;
  }

  async function rawGet() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(null, (data) => resolve(data || {}));
    });
  }

  async function get() {
    const stored = await rawGet();
    const data = { ...DEFAULTS, ...stored };
    data.preferredDialect = migrateDialect(data.preferredDialect);
    data.imeDialect = migrateDialect(data.imeDialect || data.preferredDialect);
    data.backendUrl = normalizeBackendUrl(data.backendUrl);
    if (!Object.prototype.hasOwnProperty.call(stored, "autoTranslate")) {
      data.autoTranslate = false;
    } else {
      data.autoTranslate = stored.autoTranslate === true;
    }
    data.fawEnabled = stored.fawEnabled !== false;
    data.newsToMsa = stored.newsToMsa !== false;
    data.extensionEnabled = stored.extensionEnabled !== false;
    data.imeEnabled = stored.imeEnabled !== false;
    data.addressee = data.addressee === "feminine" ? "feminine" : "masculine";
    data.favorites = clipList(data.favorites, Dox.CATALOG.maxFavorites);
    data.recents = clipList(data.recents, Dox.CATALOG.maxRecents);
    if (!data.hamaUnlocked) {
      data.favorites = data.favorites.filter((id) => id !== "arabic_syrian_hama");
      data.recents = data.recents.filter((id) => id !== "arabic_syrian_hama");
    }
    await ensureSystemLanguage(data);
    return data;
  }

  function set(patch) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set(patch, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });
  }

  async function setDefaultDialect(id) {
    const dialectId = migrateDialect(id);
    const prefs = await get();
    const recents = [dialectId, ...prefs.recents.filter((x) => x !== dialectId)].slice(
      0,
      Dox.CATALOG.maxRecents
    );
    await set({ preferredDialect: dialectId, recents });
    return dialectId;
  }

  async function setImeDialect(id) {
    const dialectId = migrateDialect(id);
    const prefs = await get();
    const recents = [dialectId, ...prefs.recents.filter((x) => x !== dialectId)].slice(
      0,
      Dox.CATALOG.maxRecents
    );
    await set({ imeDialect: dialectId, recents });
    return dialectId;
  }

  async function toggleFavorite(id) {
    const dialectId = migrateDialect(id);
    const prefs = await get();
    let favorites = prefs.favorites.slice();
    const idx = favorites.indexOf(dialectId);
    if (idx >= 0) favorites.splice(idx, 1);
    else if (favorites.length < Dox.CATALOG.maxFavorites) favorites.unshift(dialectId);
    await set({ favorites });
    return favorites;
  }

  async function setSystemLanguage(spokenId) {
    const dialectId = Dox.standardDialectFor(spokenId);
    await set({ systemLanguageId: spokenId, systemDialectId: dialectId });
    await Dox.locale.reload(dialectId);
    return dialectId;
  }

  async function clearRecents() {
    await set({ recents: [] });
  }

  function getImePosition() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["imeX", "imeY"], (data) => {
        resolve({
          imeX: Number.isFinite(data.imeX) ? data.imeX : null,
          imeY: Number.isFinite(data.imeY) ? data.imeY : null,
        });
      });
    });
  }

  function setImePosition(x, y) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ imeX: x, imeY: y }, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });
  }

  Dox.CLOUD_RUN = CLOUD_RUN;
  Dox.prefs = {
    DEFAULTS,
    get,
    set,
    setDefaultDialect,
    setImeDialect,
    toggleFavorite,
    setSystemLanguage,
    clearRecents,
    getImePosition,
    setImePosition,
    normalizeBackendUrl,
  };
})();
