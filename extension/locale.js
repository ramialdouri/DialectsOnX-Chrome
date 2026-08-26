/* DialectsOnX System Language overlay. Packs live in extension/i18n/. */
globalThis.Dox = globalThis.Dox || {};

(function () {
  if (Dox.locale) return;
  const FONT =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const frozen = new Set((Dox.CATALOG && Dox.CATALOG.frozenKeys) || []);
  const deltaKeys = new Set((Dox.CATALOG && Dox.CATALOG.deltaKeys) || []);

  let englishStrings = {};
  let strings = {};
  let systemDialectId = "english_american";
  let readyPromise = null;

  function format(template, ...args) {
    let out = String(template ?? "");
    args.forEach((arg, i) => {
      out = out.replace(new RegExp("%" + (i + 1) + "\\$s", "g"), String(arg));
      out = out.replace("%s", String(arg));
    });
    return out;
  }

  async function fetchPack(dialectId) {
    const url = chrome.runtime.getURL("i18n/" + dialectId + ".json");
    const res = await fetch(url);
    if (!res.ok) return null;
    const pack = await res.json();
    if (pack.status !== "approved" || !pack.strings) return null;
    return pack;
  }

  function applyLocks(target, dialectId) {
    const locks =
      (Dox.CATALOG.chromeChipLocks && Dox.CATALOG.chromeChipLocks[dialectId]) || {};
    Object.assign(target, locks);
    if (dialectId === "arabic_msa" && Dox.CATALOG.arabicStringLocks) {
      Object.assign(target, Dox.CATALOG.arabicStringLocks);
    }
  }

  function overlayPack(base, packStrings, dialectId) {
    const out = { ...base };
    for (const [key, value] of Object.entries(packStrings || {})) {
      if (frozen.has(key) || key.startsWith("lang_endonym_")) continue;
      if (typeof value === "string" && value) out[key] = value;
    }
    applyLocks(out, dialectId);
    return out;
  }

  async function load(dialectId) {
    const id = Dox.migrateDialectId(dialectId || "english_american");
    const spoken = Dox.spokenIdOf(id);
    const standard = spoken ? Dox.standardDialectFor(spoken) : "english_american";
    if (!Object.keys(englishStrings).length) {
      const en = await fetchPack("english_american");
      englishStrings = (en && en.strings) || {};
    }
    let pack = await fetchPack(id);
    if (!pack && standard !== id) pack = await fetchPack(standard);
    if (!pack) pack = { dialect_id: "english_american", strings: englishStrings };
    systemDialectId = pack.dialect_id || id;
    const androidBase = { ...englishStrings };
    for (const key of deltaKeys) delete androidBase[key];
    if (systemDialectId === "english_american") {
      strings = overlayPack(englishStrings, englishStrings, systemDialectId);
    } else {
      strings = overlayPack(androidBase, pack.strings, systemDialectId);
      for (const key of deltaKeys) {
        const v = pack.strings[key];
        if (typeof v === "string" && v) strings[key] = v;
        else strings[key] = "";
      }
    }
    Dox.locale.systemDialectId = systemDialectId;
    Dox.locale.rtl = Dox.isRtlDialect(systemDialectId);
    return strings;
  }

  function t(key, ...args) {
    const hit = strings[key];
    if (typeof hit === "string" && hit) return format(hit, ...args);
    if (deltaKeys.has(key) && systemDialectId !== "english_american") {
      return "";
    }
    const fallback = englishStrings[key];
    if (typeof fallback === "string" && fallback) return format(fallback, ...args);
    return key;
  }

  function dialectChip(dialectId) {
    const key = "dialect_" + dialectId;
    const labeled = t(key);
    if (labeled && labeled !== key) return labeled;
    return Dox.chipEnglish(dialectId);
  }

  function dialectHint(dialectId) {
    const desc = t("dialect_" + dialectId + "_desc");
    if (desc && desc !== "dialect_" + dialectId + "_desc") return desc;
    return (Dox.CATALOG.infoHints && Dox.CATALOG.infoHints[dialectId]) || "";
  }

  function languageLabel(spokenId) {
    const key = "lang_" + spokenId;
    const labeled = t(key);
    if (labeled && labeled !== key) return labeled;
    const row = Dox.CATALOG.spokenLanguages[spokenId];
    return (row && row.label) || spokenId;
  }

  function groupLabel(groupId) {
    const key = "lang_group_" + groupId;
    const labeled = t(key);
    if (labeled && labeled !== key) return labeled;
    return Dox.CATALOG.languageGroups[groupId] || groupId;
  }

  function chipButtonText(dialectId) {
    const spoken = Dox.spokenIdOf(dialectId);
    return languageLabel(spoken) + " · " + dialectChip(dialectId);
  }

  function grokQuery(dialectId) {
    if (Dox.CATALOG.grokPromptOverride[dialectId]) {
      return Dox.CATALOG.grokPromptOverride[dialectId];
    }
    const promptKey = "dialect_" + dialectId + "_prompt";
    const label = t(promptKey);
    const name = label && label !== promptKey ? label : dialectChip(dialectId);
    const spoken = Dox.spokenIdOf(dialectId);
    if ((spoken === "spanish" || spoken === "italian") && dialectId.indexOf("spanglish") < 0) {
      return t("grok_dialect_prompt_accent", name);
    }
    if (Dox.CATALOG.grokDialectSuffix.indexOf(dialectId) >= 0) {
      return t("grok_dialect_prompt_dialect", name);
    }
    if (Dox.CATALOG.grokLanguageSuffix.indexOf(dialectId) >= 0) {
      return t("grok_dialect_prompt_language", name);
    }
    return name;
  }

  function applyDir(el) {
    if (!el) return;
    el.setAttribute("dir", Dox.locale.rtl ? "rtl" : "ltr");
    el.style.fontFamily = FONT;
  }

  Dox.FONT = FONT;
  Dox.locale = {
    t,
    format,
    load,
    dialectChip,
    dialectHint,
    languageLabel,
    groupLabel,
    chipButtonText,
    grokQuery,
    applyDir,
    systemDialectId,
    rtl: false,
    ready() {
      if (!readyPromise) {
        readyPromise = (async () => {
          const prefs = await Dox.prefs.get();
          await load(prefs.systemDialectId);
        })();
      }
      return readyPromise;
    },
    reload(dialectId) {
      readyPromise = load(dialectId);
      return readyPromise;
    },
  };
})();
