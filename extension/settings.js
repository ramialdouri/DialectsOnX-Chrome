document.addEventListener("DOMContentLoaded", async () => {
  await Dox.locale.ready();
  Dox.locale.applyDir(document.documentElement);
  const t = Dox.locale.t;
  const prefs = await Dox.prefs.get();

  document.getElementById("title").textContent = t("home_settings");
  document.getElementById("sysLangLabel").textContent = t("system_language_title");
  document.getElementById("sysLangBtn").textContent = Dox.locale.languageLabel(
    prefs.systemLanguageId || Dox.spokenIdOf(prefs.systemDialectId)
  );
  document.getElementById("autoLabel").textContent = t("dox_auto_translate");
  document.getElementById("fawLabel").textContent = t("settings_faw");
  document.getElementById("newsLabel").textContent = t("dox_news_to_msa");
  document.getElementById("imeLabel").textContent = t("dox_ime_enabled");
  document.getElementById("clearCache").textContent = t("settings_clear_cache");
  document.getElementById("clearRecents").textContent = t("dox_clear_recents");
  document.getElementById("cacheHint").textContent = t("settings_clear_cache_body");
  document.getElementById("padLink").textContent = t("dox_open_pad");
  document.getElementById("about").textContent = t("dox_about_line", "0.3.0");
  document.getElementById("autoTranslate").checked = prefs.autoTranslate === true;
  document.getElementById("fawEnabled").checked = prefs.fawEnabled !== false;
  document.getElementById("newsToMsa").checked = prefs.newsToMsa !== false;
  document.getElementById("imeEnabled").checked = prefs.imeEnabled !== false;

  document.getElementById("sysTitle").textContent = t("system_language_title");
  document.getElementById("sysSearch").placeholder = t("system_language_search_hint");
  document.getElementById("sysSearch").setAttribute("aria-label", t("cd_language_search"));
  document.getElementById("sysBack").setAttribute("aria-label", t("action_back"));
  document.getElementById("sysSearchClear").title = t("cd_language_search_clear");
  Dox.systemLanguage.injectStyles();

  const info = document.getElementById("fawInfo");
  info.replaceChildren(Dox.icon("info", 16));
  info.setAttribute("aria-label", t("cd_faw_howto"));
  info.title = t("cd_faw_howto");
  const howto = document.getElementById("fawHowto");
  howto.textContent = t("settings_faw_howto");
  if (typeof howto.showPopover === "function") {
    howto.removeAttribute("hidden");
    howto.setAttribute("popover", "auto");
    info.setAttribute("popovertarget", "fawHowto");
    info.setAttribute("aria-haspopup", "dialog");
  } else {
    info.setAttribute("aria-expanded", "false");
    info.setAttribute("aria-controls", "fawHowto");
    const closeHowto = () => {
      howto.hidden = true;
      info.setAttribute("aria-expanded", "false");
    };
    info.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const open = howto.hidden;
      howto.hidden = !open;
      info.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("pointerdown", (e) => {
      if (!howto.hidden && e.target !== info && !howto.contains(e.target)) closeHowto();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !howto.hidden) closeHowto();
    });
  }

  function bindToggle(id, key) {
    const el = document.getElementById(id);
    el.setAttribute("aria-checked", el.checked ? "true" : "false");
    el.addEventListener("change", async (e) => {
      e.target.setAttribute("aria-checked", e.target.checked ? "true" : "false");
      await Dox.prefs.set({ [key]: e.target.checked });
    });
  }
  bindToggle("autoTranslate", "autoTranslate");
  bindToggle("fawEnabled", "fawEnabled");
  bindToggle("newsToMsa", "newsToMsa");
  bindToggle("imeEnabled", "imeEnabled");

  document.getElementById("clearCache").addEventListener("click", async () => {
    if (typeof Dox.faw?.clearPersonal === "function") await Dox.faw.clearPersonal();
    else await chrome.storage.local.remove(["fawPersonal"]);
  });
  document.getElementById("clearRecents").addEventListener("click", () => Dox.prefs.clearRecents());

  const selectedSpoken = () =>
    prefs.systemLanguageId || Dox.spokenIdOf(prefs.systemDialectId);

  function renderSys(query) {
    const input = document.getElementById("sysSearch");
    const clear = document.getElementById("sysSearchClear");
    if (input && input.value !== query) input.value = query;
    if (clear) clear.hidden = !String(query || "").trim();
    Dox.systemLanguage.renderList(
      document.getElementById("sysList"),
      query,
      selectedSpoken(),
      async (languageId) => {
        if (languageId === selectedSpoken()) return;
        await Dox.prefs.setSystemLanguage(languageId);
        location.reload();
      }
    );
  }

  document.getElementById("sysLangBtn").addEventListener("click", () => {
    document.getElementById("main").classList.add("hidden");
    document.getElementById("sysView").classList.remove("hidden");
    document.getElementById("sysSearch").value = "";
    renderSys("");
    document.getElementById("sysSearch").focus();
  });
  document.getElementById("sysBack").addEventListener("click", () => {
    document.getElementById("sysView").classList.add("hidden");
    document.getElementById("main").classList.remove("hidden");
  });
  document.getElementById("sysSearch").addEventListener("input", (e) => renderSys(e.target.value));
  document.getElementById("sysSearchClear").addEventListener("click", () => {
    document.getElementById("sysSearch").value = "";
    renderSys("");
    document.getElementById("sysSearch").focus();
  });
});
