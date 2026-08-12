(function () {
  const DEFAULT_BACKEND =
    "https://dialex-backend-f6b7-1086119311146.europe-west3.run.app";
  const EMPTY_OUTPUT = "The dialect version appears here.";

  function normalizeBackendUrl(url) {
    const trimmed = (url || "").trim().replace(/\/+$/, "");
    return trimmed || DEFAULT_BACKEND;
  }

  async function translateText({ text, targetDialect, backendUrl, signal }) {
    const res = await fetch(`${normalizeBackendUrl(backendUrl)}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        target_dialect: targetDialect,
        source_language: "auto",
        client_source: "pad",
      }),
      signal,
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        detail = err.detail?.detail || err.detail || err.error || detail;
        if (typeof detail !== "string") detail = JSON.stringify(detail);
      } catch (_) {}
      throw new Error(detail);
    }
    return res.json();
  }

  async function speechToText({ blob, backendUrl }) {
    const form = new FormData();
    form.append("file", blob, "pad.webm");
    const res = await fetch(`${normalizeBackendUrl(backendUrl)}/stt`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        detail = err.detail || err.error || detail;
        if (typeof detail !== "string") detail = JSON.stringify(detail);
      } catch (_) {}
      throw new Error(detail);
    }
    return res.json();
  }

  function initPad() {
    const catalog = window.DialexCatalog;
    const sheet = window.DialexSheet;
    if (!catalog || !sheet) return;

    const backendUrl = DEFAULT_BACKEND;
    const inputEl = document.getElementById("pad-input");
    const outputEl = document.getElementById("pad-output");
    const translitEl = document.getElementById("pad-translit");
    const statusEl = document.getElementById("pad-status");
    const bumpBtn = document.getElementById("pad-dialect-bump");
    const bumpLabel = document.getElementById("pad-dialect-label");
    const translateBtn = document.getElementById("pad-translate");
    const micBtn = document.getElementById("pad-mic");
    const clearBtn = document.getElementById("pad-clear");
    const shareBtn = document.getElementById("pad-share");

    let languageId = catalog.DEFAULT_LANGUAGE;
    let dialectId = catalog.DEFAULT_DIALECT;
    let mediaRecorder = null;
    let chunks = [];
    let busy = false;

    function setStatus(msg, kind) {
      statusEl.textContent = msg || "";
      statusEl.classList.toggle("error", kind === "error");
    }

    function setOutput(text, isPlaceholder) {
      outputEl.textContent = text;
      outputEl.classList.toggle("has-result", !isPlaceholder);
    }

    function refreshBump() {
      const label = catalog.summaryLabel(dialectId);
      if (bumpLabel) bumpLabel.textContent = label;
      else bumpBtn.textContent = label;
    }

    function isEmptyOutput() {
      const t = outputEl.textContent?.trim() || "";
      return !t || t === EMPTY_OUTPUT;
    }

    async function runTranslate() {
      const text = inputEl.value.trim();
      if (!text) {
        setStatus("Enter text or use the mic first.", "error");
        return;
      }
      if (busy) return;
      busy = true;
      translateBtn.disabled = true;
      setStatus("Translating...");
      try {
        const data = await translateText({
          text,
          targetDialect: dialectId,
          backendUrl,
        });
        setOutput(data.translation || "", false);
        if (data.transliteration) {
          translitEl.hidden = false;
          translitEl.textContent = data.transliteration;
        } else {
          translitEl.hidden = true;
          translitEl.textContent = "";
        }
        sheet.pushRecent(dialectId);
        setStatus(data.cached ? "Done (cached)" : "Done");
      } catch (err) {
        setStatus(err.message || "Translation failed", "error");
      } finally {
        busy = false;
        translateBtn.disabled = false;
      }
    }

    function openSheet() {
      sheet.openDialectSheet({
        languageId,
        dialectId,
        onSelect: ({ languageId: lid, dialectId: did }) => {
          languageId = lid;
          dialectId = did;
          refreshBump();
          if (inputEl.value.trim()) runTranslate();
        },
      });
    }

    async function toggleMic() {
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("Microphone not supported in this browser.", "error");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];
        const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
        mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          micBtn.classList.remove("recording");
          const blob = new Blob(chunks, { type: mime });
          if (!blob.size) {
            setStatus("No audio captured.", "error");
            return;
          }
          setStatus("Transcribing...");
          try {
            const stt = await speechToText({ blob, backendUrl });
            inputEl.value = stt.text || "";
            await runTranslate();
          } catch (err) {
            setStatus(err.message || "STT failed", "error");
          }
        };
        mediaRecorder.start();
        micBtn.classList.add("recording");
        setStatus("Recording... tap mic to stop");
      } catch {
        setStatus("Microphone permission denied.", "error");
      }
    }

    bumpBtn.addEventListener("click", openSheet);
    document.getElementById("pad-output-pane")?.addEventListener("click", (e) => {
      if (e.target === outputEl || e.target.id === "pad-output-pane") {
        if (isEmptyOutput()) openSheet();
      }
    });
    translateBtn.addEventListener("click", runTranslate);
    micBtn.addEventListener("click", toggleMic);
    clearBtn.addEventListener("click", () => {
      inputEl.value = "";
      setOutput(EMPTY_OUTPUT, true);
      translitEl.hidden = true;
      translitEl.textContent = "";
      setStatus("");
    });
    shareBtn.addEventListener("click", async () => {
      const text = outputEl.textContent?.trim();
      if (!text || text === EMPTY_OUTPUT) {
        setStatus("Nothing to share yet.", "error");
        return;
      }
      try {
        if (navigator.share) {
          await navigator.share({ text });
        } else {
          await navigator.clipboard.writeText(text);
          setStatus("Copied translation");
        }
      } catch {
        setStatus("Share canceled");
      }
    });

    refreshBump();
  }

  window.DialexPad = { initPad, DEFAULT_BACKEND, normalizeBackendUrl, translateText };
})();
