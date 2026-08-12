const DEFAULT_BACKEND_URL =
  "https://dialex-backend-f6b7-1086119311146.europe-west3.run.app";

const input = document.getElementById("backendUrl");
const saveBtn = document.getElementById("save");
const resetLink = document.getElementById("reset");
const status = document.getElementById("status");
const healthBtn = document.getElementById("health");
const healthStatus = document.getElementById("healthStatus");

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

async function checkHealth() {
  const url = normalizeBackendUrl(input.value) || DEFAULT_BACKEND_URL;
    healthStatus.textContent = "Checking...";
  try {
    const res = await fetch(`${url}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    healthStatus.textContent = `Connected · status ${data.status} · cache ${data.cache || "n/a"}`;
  } catch (err) {
    healthStatus.textContent = `Unreachable · ${err.message || "error"}`;
  }
}

saveBtn.addEventListener("click", save);
healthBtn.addEventListener("click", checkHealth);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") save();
});
resetLink.addEventListener("click", () => {
  input.value = DEFAULT_BACKEND_URL;
  save();
});

document.addEventListener("DOMContentLoaded", loadSavedUrl);
loadSavedUrl();
