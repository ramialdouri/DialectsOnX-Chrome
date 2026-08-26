document.addEventListener("DOMContentLoaded", async () => {
  await Dox.locale.ready();
  Dox.locale.applyDir(document.documentElement);
  const prefs = await Dox.prefs.get();
  document.getElementById("ver").textContent = Dox.locale.t("dox_about_line", "0.3.0");
  document.getElementById("onLabel").textContent = prefs.extensionEnabled
    ? Dox.locale.t("dox_on")
    : Dox.locale.t("dox_off");
  const enabled = document.getElementById("enabled");
  enabled.checked = prefs.extensionEnabled;
  enabled.addEventListener("change", async () => {
    await Dox.prefs.set({ extensionEnabled: enabled.checked });
    document.getElementById("onLabel").textContent = enabled.checked
      ? Dox.locale.t("dox_on")
      : Dox.locale.t("dox_off");
  });
  document.getElementById("ime").textContent = Dox.locale.t("dox_ime_show");
  const settings = document.getElementById("settings");
  settings.replaceChildren(Dox.icon("gear", 16));
  settings.setAttribute("aria-label", Dox.locale.t("home_settings"));
  settings.title = Dox.locale.t("home_settings");
  document.getElementById("ime").addEventListener("click", async () => {
    await Dox.prefs.set({ imeCollapsed: false, imeEnabled: true, extensionEnabled: true });
    chrome.runtime.sendMessage({ type: "dox-ime-show" });
  });
  settings.addEventListener("click", () => Dox.openSettings());
});
