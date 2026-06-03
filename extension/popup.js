const DEFAULT_BACKEND_URL = "https://dialx-backend.onrender.com";

const input = document.getElementById("backendUrl");
const saveBtn = document.getElementById("save");
const resetLink = document.getElementById("reset");
const status = document.getElementById("status");

function normalizeBackendUrl(url) {
  return (url || "").trim().replace(/\/+$/, "");
}

function showStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
  status.classList.add("show");
  clearTimeout(showStatus._t);
  showStatus._t = setTimeout(() => status.classList.remove("show"), 2000);
}

function loadSavedUrl() {
  chrome.storage.sync.get({ backendUrl: DEFAULT_BACKEND_URL }, (data) => {
    input.value = normalizeBackendUrl(data.backendUrl) || DEFAULT_BACKEND_URL;
  });
}

function save() {
  const url = normalizeBackendUrl(input.value) || DEFAULT_BACKEND_URL;
  try {
    new URL(url);
  } catch {
    showStatus("Enter a valid URL", true);
    return;
  }
  input.value = url;
  chrome.storage.sync.set({ backendUrl: url }, () => {
    if (chrome.runtime.lastError) {
      showStatus("Could not save", true);
      return;
    }
    showStatus("Saved");
  });
}

saveBtn.addEventListener("click", save);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") save();
});
resetLink.addEventListener("click", () => {
  input.value = DEFAULT_BACKEND_URL;
  save();
});

document.addEventListener("DOMContentLoaded", loadSavedUrl);
loadSavedUrl();
