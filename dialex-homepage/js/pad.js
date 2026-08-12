(function () {
  const DEFAULT_BACKEND =
    "https://dialex-backend-f6b7-1086119311146.europe-west3.run.app";

  function normalizeBackendUrl(url) {
    const trimmed = (url || "").trim().replace(/\/+$/, "");
    return trimmed || DEFAULT_BACKEND;
  }

  async function translateText({
    text,
    targetDialect,
    backendUrl = DEFAULT_BACKEND,
    clientSource = "pad",
    signal,
  }) {
    const endpoint = `${normalizeBackendUrl(backendUrl)}/translate`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        target_dialect: targetDialect,
        source_language: "auto",
        client_source: clientSource,
      }),
      signal,
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        detail = err.detail?.detail || err.detail || err.error || detail;
        if (typeof detail !== "string") detail = JSON.stringify(detail);
      } catch (_) {
        /* ignore */
      }
      throw new Error(detail);
    }
    return res.json();
  }

  async function speechToText({ blob, filename = "pad.webm", backendUrl = DEFAULT_BACKEND, signal }) {
    const endpoint = `${normalizeBackendUrl(backendUrl)}/stt`;
    const form = new FormData();
    form.append("file", blob, filename);
    const res = await fetch(endpoint, { method: "POST", body: form, signal });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        detail = err.detail || err.error || detail;
        if (typeof detail !== "string") detail = JSON.stringify(detail);
      } catch (_) {
        /* ignore */
      }
      throw new Error(detail);
    }
    return res.json();
  }

  function initPad(options = {}) {
    const catalog = window.DialexCatalog;
    const backendUrl = normalizeBackendUrl(options.backendUrl || DEFAULT_BACKEND);

    const inputEl = document.getElementById("pad-input");
    const outputEl = document.getElementById("pad-output");
    const translitEl = document.getElementById("pad-translit");
    const statusEl = document.getElementById("pad-status");
    const languageEl = document.getElementById("pad-language");
    const dialectsEl = document.getElementById("pad-dialects");
    const translateBtn = document.getElementById("pad-translate");
    const micBtn = document.getElementById("pad-mic");

    if (!inputEl || !catalog) return;

    let languageId = catalog.DEFAULT_LANGUAGE;
    let dialectId = catalog.DEFAULT_DIALECT;
    let mediaRecorder = null;
    let chunks = [];
    let busy = false;

    function setStatus(message, kind) {
      statusEl.textContent = message || "";
      statusEl.classList.remove("error", "ok");
      if (kind) statusEl.classList.add(kind);
    }

    function renderLanguages() {
      languageEl.innerHTML = "";
      catalog.languages.forEach((lang) => {
        const opt = document.createElement("option");
        opt.value = lang.id;
        opt.textContent = lang.name;
        languageEl.appendChild(opt);
      });
      languageEl.value = languageId;
    }

    function renderDialects() {
      dialectsEl.innerHTML = "";
      catalog.dialectsFor(languageId).forEach((dialect) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chip" + (dialect.id === dialectId ? " selected" : "");
        btn.textContent = dialect.name;
        btn.setAttribute("role", "option");
        btn.setAttribute("aria-selected", dialect.id === dialectId ? "true" : "false");
        btn.addEventListener("click", () => {
          dialectId = dialect.id;
          renderDialects();
          if (inputEl.value.trim()) runTranslate();
        });
        dialectsEl.appendChild(btn);
      });
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
      setStatus("Translating…");
      try {
        const data = await translateText({
          text,
          targetDialect: dialectId,
          backendUrl,
          clientSource: "pad",
        });
        outputEl.textContent = data.translation || "";
        if (data.transliteration) {
          translitEl.hidden = false;
          translitEl.textContent = data.transliteration;
        } else {
          translitEl.hidden = true;
          translitEl.textContent = "";
        }
        setStatus(data.cached ? "Done (cached)" : "Done", "ok");
      } catch (err) {
        setStatus(err.message || "Translation failed", "error");
      } finally {
        busy = false;
        translateBtn.disabled = false;
      }
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
          micBtn.setAttribute("aria-label", "Start voice input");
          const blob = new Blob(chunks, { type: mime });
          if (!blob.size) {
            setStatus("No audio captured.", "error");
            return;
          }
          setStatus("Transcribing…");
          busy = true;
          try {
            const stt = await speechToText({
              blob,
              filename: "pad.webm",
              backendUrl,
            });
            inputEl.value = stt.text || "";
            setStatus("Transcribed — translating…");
            await runTranslate();
          } catch (err) {
            setStatus(err.message || "STT failed", "error");
          } finally {
            busy = false;
          }
        };
        mediaRecorder.start();
        micBtn.classList.add("recording");
        micBtn.setAttribute("aria-label", "Stop recording");
        setStatus("Recording… tap mic to stop");
      } catch (err) {
        setStatus("Microphone permission denied.", "error");
      }
    }

    languageEl.addEventListener("change", () => {
      languageId = languageEl.value;
      const next = catalog.defaultDialectFor(languageId);
      dialectId = next ? next.id : catalog.DEFAULT_DIALECT;
      renderDialects();
    });
    translateBtn.addEventListener("click", runTranslate);
    micBtn.addEventListener("click", toggleMic);

    renderLanguages();
    renderDialects();
  }

  window.DialexPad = {
    DEFAULT_BACKEND,
    normalizeBackendUrl,
    translateText,
    speechToText,
    initPad,
  };
})();
