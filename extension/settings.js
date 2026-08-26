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
  document.getElementById("defaultLabel").textContent = t("dox_default_dialect");
  document.getElementById("defaultBtn").textContent = Dox.locale.chipButtonText(prefs.preferredDialect);
  document.getElementById("autoLabel").textContent = t("dox_auto_translate");
  document.getElementById("fawLabel").textContent = t("settings_faw");
  document.getElementById("newsLabel").textContent = t("dox_news_to_msa");
  document.getElementById("addresseeLabel").textContent = t("dox_addressee");
  document.getElementById("mLabel").textContent = t("addressee_masculine");
  document.getElementById("fLabel").textContent = t("addressee_feminine");
  document.getElementById("imeLabel").textContent = t("dox_ime_enabled");
  document.getElementById("imeRememberLabel").textContent = t("dox_ime_remember");
  document.getElementById("advLabel").textContent = t("dox_advanced");
  document.getElementById("urlLabel").textContent = t("dox_backend_url");
  document.getElementById("saveUrl").textContent = t("about_ok");
  document.getElementById("backendUrl").value = prefs.backendUrl;
  document.getElementById("urlHint").textContent = Dox.CLOUD_RUN;
  document.getElementById("clearCache").textContent = t("settings_clear_cache");
  document.getElementById("clearRecents").textContent = t("dox_clear_recents");
  document.getElementById("cacheHint").textContent = t("settings_clear_cache_body");
  document.getElementById("padLink").textContent = t("dox_open_pad");
  document.getElementById("about").textContent = t("dox_about_line", "0.3.0");
  document.getElementById("autoTranslate").checked = prefs.autoTranslate === true;
  document.getElementById("fawEnabled").checked = prefs.fawEnabled !== false;
  document.getElementById("newsToMsa").checked = prefs.newsToMsa !== false;
  document.getElementById("imeEnabled").checked = prefs.imeEnabled !== false;
  document.getElementById("imeRemember").checked = prefs.imeRememberPosition !== false;
  document.querySelector(`input[name="addressee"][value="${prefs.addressee}"]`).checked = true;

  document.getElementById("sysTitle").textContent = t("system_language_title");
  document.getElementById("sysSearch").placeholder = t("system_language_search_hint");
  document.getElementById("sysBack").textContent = t("action_back");

  function bindToggle(id, key, extra) {
    document.getElementById(id).addEventListener("change", async (e) => {
      await Dox.prefs.set({ [key]: e.target.checked, ...(extra ? extra(e.target.checked) : {}) });
    });
  }
  bindToggle("autoTranslate", "autoTranslate");
  bindToggle("fawEnabled", "fawEnabled");
  bindToggle("newsToMsa", "newsToMsa");
  bindToggle("imeEnabled", "imeEnabled");
  bindToggle("imeRemember", "imeRememberPosition");

  document.querySelectorAll('input[name="addressee"]').forEach((el) => {
    el.addEventListener("change", async () => {
      if (el.checked) await Dox.prefs.set({ addressee: el.value });
    });
  });

  document.getElementById("defaultBtn").addEventListener("click", () => {
    Dox.sheet.open({
      mode: "default",
      selectedId: prefs.preferredDialect,
      onPick: (id) => {
        document.getElementById("defaultBtn").textContent = Dox.locale.chipButtonText(id);
      },
    });
  });

  document.getElementById("saveUrl").addEventListener("click", async () => {
    const url = Dox.prefs.normalizeBackendUrl(document.getElementById("backendUrl").value);
    try {
      new URL(url);
    } catch {
      return;
    }
    await Dox.prefs.set({ backendUrl: url });
    document.getElementById("backendUrl").value = url;
  });

  document.getElementById("clearCache").addEventListener("click", async () => {
    if (typeof Dox.faw?.clearPersonal === "function") await Dox.faw.clearPersonal();
    else await chrome.storage.local.remove(["fawPersonal"]);
  });
  document.getElementById("clearRecents").addEventListener("click", () => Dox.prefs.clearRecents());

  document.getElementById("sysLangBtn").addEventListener("click", () => {
    document.getElementById("main").classList.add("hidden");
    document.getElementById("sysView").classList.remove("hidden");
    renderSys("");
  });
  document.getElementById("sysBack").addEventListener("click", () => {
    document.getElementById("sysView").classList.add("hidden");
    document.getElementById("main").classList.remove("hidden");
  });
  document.getElementById("sysSearch").addEventListener("input", (e) => renderSys(e.target.value));

  function renderSys(query) {
    const q = query.trim().toLowerCase();
    const list = document.getElementById("sysList");
    list.replaceChildren();
    for (const group of Dox.CATALOG.groups) {
      for (const lang of group.languages) {
        const endonym = lang.endonym || lang.label;
        const en = lang.label;
        const hay = (endonym + " " + en + " " + lang.id).toLowerCase();
        if (q && !hay.includes(q)) continue;
        const row = document.createElement("div");
        row.className = "sys-row";
        const left = document.createElement("span");
        left.className = "sys-endonym";
        left.textContent = endonym;
        const right = document.createElement("span");
        right.className = "sys-en";
        right.textContent = endonym !== en ? en : "";
        row.append(left, right);
        if (lang.id === (prefs.systemLanguageId || Dox.spokenIdOf(prefs.systemDialectId))) {
          const check = document.createElement("span");
          check.textContent = "✓";
          check.style.color = "#E0B83A";
          row.appendChild(check);
        }
        row.addEventListener("click", async () => {
          const did = await Dox.prefs.setSystemLanguage(lang.id);
          document.getElementById("sysLangBtn").textContent = Dox.locale.languageLabel(lang.id);
          Dox.locale.applyDir(document.documentElement);
          document.getElementById("sysView").classList.add("hidden");
          document.getElementById("main").classList.remove("hidden");
          location.reload();
          void did;
        });
        list.appendChild(row);
      }
    }
  }
});
