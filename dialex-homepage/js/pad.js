(function () {
  const DEFAULT_BACKEND =
    "https://dialex-backend-f6b7-1086119311146.europe-west3.run.app";

  async function translateText({ text, targetDialect, signal }) {
    const res = await fetch(`${DEFAULT_BACKEND}/translate`, {
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

  async function speechToText({ blob }) {
    const stt = window.DialexStt;
    if (!stt) throw new Error("Transcription failed.");
    return stt.transcribe({ backendUrl: DEFAULT_BACKEND, blob });
  }

  function initPad() {
    const catalog = window.DialexCatalog;
    const sheet = window.DialexSheet;
    if (!catalog || !sheet) return;

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
    let stopping = false;
    let recordTimer = null;
    const RECORD_MAX_MS = 60000;

    function setStatus(msg, kind) {
      statusEl.textContent = msg || "";
      statusEl.classList.toggle("error", kind === "error");
    }

    function setOutput(text, isPlaceholder) {
      outputEl.textContent = text;
      outputEl.classList.toggle("has-result", !isPlaceholder);
      refreshOutputActions();
    }

    function refreshBump() {
      const label = catalog.summaryLabel(dialectId);
      if (bumpLabel) bumpLabel.textContent = label;
      else bumpBtn.textContent = label;
    }

    function isEmptyOutput() {
      return !(outputEl.textContent || "").trim();
    }

    function refreshOutputActions() {
      const hasOutput = !isEmptyOutput();
      const canClear = Boolean(inputEl.value.trim()) || hasOutput;
      shareBtn.disabled = !hasOutput;
      clearBtn.disabled = !canClear;
    }

    async function runTranslate() {
      const text = inputEl.value.trim();
      if (!text) {
        setStatus("Enter text, or record with the microphone.", "error");
        return;
      }
      if (busy) return;
      busy = true;
      translateBtn.disabled = true;
      if (micBtn) micBtn.disabled = true;
      setStatus("Translating...");
      try {
        const data = await translateText({
          text,
          targetDialect: dialectId,
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
        setStatus(err.message || "Translation failed.", "error");
      } finally {
        busy = false;
        translateBtn.disabled = false;
        if (micBtn) micBtn.disabled = false;
      }
    }

    function openSheet() {
      sheet.openDialectSheet({
        languageId,
        dialectId,
        onSelect: ({ languageId: lid, dialectId: did, complete }) => {
          languageId = lid;
          dialectId = did;
          refreshBump();
          if (complete && inputEl.value.trim()) runTranslate();
        },
      });
    }

    async function toggleMic() {
      if (mediaRecorder && mediaRecorder.state === "recording") {
        stopping = true;
        mediaRecorder.stop();
        return;
      }
      if (busy || stopping) return;
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setStatus("Microphone needs a secure (https) page.", "error");
        return;
      }
      const stt = window.DialexStt;
      if (!stt) {
        setStatus("Transcription failed.", "error");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];
        const mime = stt.recorderMime();
        mediaRecorder = mime
          ? new MediaRecorder(stream, { mimeType: mime })
          : new MediaRecorder(stream);
        const usedMime = mediaRecorder.mimeType || mime || "audio/webm";
        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size) chunks.push(e.data);
        };
        mediaRecorder.onstop = async () => {
          if (recordTimer) {
            clearTimeout(recordTimer);
            recordTimer = null;
          }
          stopping = false;
          stream.getTracks().forEach((t) => t.stop());
          micBtn.classList.remove("recording");
          mediaRecorder = null;
          const blob = new Blob(chunks, { type: usedMime });
          if (!blob.size) {
            setStatus("No audio captured.", "error");
            return;
          }
          busy = true;
          translateBtn.disabled = true;
          if (micBtn) micBtn.disabled = true;
          setStatus("Transcribing...");
          try {
            const result = await speechToText({ blob });
            inputEl.value = result.text || "";
          } catch (err) {
            busy = false;
            translateBtn.disabled = false;
            if (micBtn) micBtn.disabled = false;
            setStatus(err.message || "Transcription failed.", "error");
            return;
          }
          busy = false;
          translateBtn.disabled = false;
          if (micBtn) micBtn.disabled = false;
          await runTranslate();
        };
        mediaRecorder.start(250);
        micBtn.classList.add("recording");
        setStatus("Recording. Tap the microphone to stop.");
        recordTimer = setTimeout(() => {
          if (mediaRecorder && mediaRecorder.state === "recording") {
            stopping = true;
            mediaRecorder.stop();
          }
        }, RECORD_MAX_MS);
      } catch {
        stopping = false;
        micBtn.classList.remove("recording");
        setStatus("Microphone permission was denied.", "error");
      }
    }

    bumpBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openSheet();
    });
    document.getElementById("pad-output-pane")?.addEventListener("click", (e) => {
      if (e.target.closest(".dialect-bump")) return;
      if (e.target === outputEl || e.target.id === "pad-output-pane") {
        if (isEmptyOutput()) openSheet();
      }
    });
    translateBtn.addEventListener("click", runTranslate);
    micBtn.addEventListener("click", toggleMic);
    clearBtn.addEventListener("click", () => {
      inputEl.value = "";
      setOutput("", true);
      translitEl.hidden = true;
      translitEl.textContent = "";
      setStatus("");
    });
    shareBtn.addEventListener("click", async () => {
      const text = outputEl.textContent?.trim();
      if (!text) return;
      try {
        if (navigator.share) {
          await navigator.share({ text });
        } else {
          await navigator.clipboard.writeText(text);
          setStatus("Copied to clipboard.");
        }
      } catch {
        setStatus("Share canceled.");
      }
    });
    inputEl.addEventListener("input", refreshOutputActions);

    refreshBump();
    refreshOutputActions();
  }

  window.DialexPad = { initPad, translateText };
})();
