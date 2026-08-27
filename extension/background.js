/* MV3 service worker: offscreen STT + IME restore broadcast. */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "dox-open-settings") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === "dox-ime-show") {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) chrome.tabs.sendMessage(tab.id, { type: "dox-ime-show" }).catch(() => {});
      }
    });
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === "dox-stt") {
    (async () => {
      try {
        await ensureOffscreen();
        const result = await chrome.runtime.sendMessage({
          type: "dox-stt-record",
          language: msg.language || "",
        });
        sendResponse(result);
      } catch (e) {
        sendResponse({ error: String(e && e.message ? e.message : e) });
      }
    })();
    return true;
  }
  return false;
});

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  if (contexts && contexts.length) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["USER_MEDIA"],
    justification: "Record microphone audio for Dialex speech-to-text",
  });
}
