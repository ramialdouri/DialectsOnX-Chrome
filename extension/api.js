/* Dialex Cloud Run / local uvicorn client. Never silently return the source. */
globalThis.Dox = globalThis.Dox || {};

(function () {
  if (Dox.api) return;
  const TRANSLATE_TIMEOUT_MS = 90_000;

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  async function deviceId() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["deviceId"], (data) => {
        if (data.deviceId) {
          resolve(data.deviceId);
          return;
        }
        const id = uuid();
        chrome.storage.local.set({ deviceId: id }, () => resolve(id));
      });
    });
  }

  async function baseUrl() {
    const prefs = await Dox.prefs.get();
    return Dox.prefs.normalizeBackendUrl(prefs.backendUrl);
  }

  async function headers() {
    return {
      "Content-Type": "application/json",
      "X-Device-Id": await deviceId(),
    };
  }

  class DoxApiError extends Error {
    constructor(code, status, detail) {
      super(detail || code);
      this.name = "DoxApiError";
      this.code = code;
      this.status = status;
    }
  }

  function mapError(status, body) {
    const err = body && (body.error || (body.detail && body.detail.error));
    const detail =
      (body && body.detail && (body.detail.detail || body.detail.error)) ||
      (typeof body?.detail === "string" ? body.detail : "") ||
      "";
    if (status === 429 || err === "rate_limited") {
      return new DoxApiError("rate_limited", 429, Dox.locale.t("dox_rate_limited"));
    }
    if (status === 400) {
      return new DoxApiError(err || "bad_request", 400, detail || Dox.locale.t("dox_translate_failed"));
    }
    return new DoxApiError(err || "http_error", status, detail || Dox.locale.t("error_network"));
  }

  async function request(path, { method = "GET", json, timeoutMs = TRANSLATE_TIMEOUT_MS, signal } = {}) {
    const url = (await baseUrl()) + path;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    if (signal) {
      if (signal.aborted) ctrl.abort();
      else signal.addEventListener("abort", () => ctrl.abort(), { once: true });
    }
    try {
      const res = await fetch(url, {
        method,
        headers: await headers(),
        body: json ? JSON.stringify(json) : undefined,
        signal: ctrl.signal,
      });
      let body = null;
      const text = await res.text();
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = { raw: text };
        }
      }
      if (!res.ok) throw mapError(res.status, body);
      return body;
    } catch (e) {
      if (e instanceof DoxApiError) throw e;
      if (e && e.name === "AbortError") throw e;
      throw new DoxApiError("network", 0, Dox.locale.t("error_network"));
    } finally {
      clearTimeout(timer);
    }
  }

  async function fawFingerprint(dialectId) {
    const id = Dox.migrateDialectId(dialectId);
    const body = await request(
      "/faw/fingerprint?dialect_id=" + encodeURIComponent(id),
      { method: "GET", timeoutMs: 15_000 }
    );
    return (body && body.fingerprint) || "";
  }

  async function translate({
    text,
    targetDialect,
    clientSource,
    addressee,
    signal,
    fingerprint,
  }) {
    const prefs = await Dox.prefs.get();
    const dialect = Dox.migrateDialectId(targetDialect);
    const fp = fingerprint || (await fawFingerprint(dialect));
    const body = await request("/translate", {
      method: "POST",
      signal,
      json: {
        text,
        target_dialect: dialect,
        source_language: "auto",
        client_source: clientSource,
        addressee: addressee || prefs.addressee || "masculine",
        formality: "auto",
        speaker_gender: "unknown",
        previous_turn: "",
      },
    });
    return {
      translation: body.translation,
      transliteration: body.transliteration || "",
      cached: Boolean(body.cached),
      fawOverlay: body.faw_overlay || fp,
      fingerprint: fp,
    };
  }

  async function submitFaw(payload) {
    return request("/faw", {
      method: "POST",
      json: {
        ...payload,
        client_source: "dialectsonx",
      },
    });
  }

  async function deleteFaw() {
    return request("/faw", { method: "DELETE" });
  }

  async function stt(wavBlob, language) {
    const url = (await baseUrl()) + "/stt";
    const form = new FormData();
    form.append("file", wavBlob, "speech.wav");
    if (language) form.append("language", language);
    const res = await fetch(url, {
      method: "POST",
      headers: { "X-Device-Id": await deviceId() },
      body: form,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw mapError(res.status, body);
    return body;
  }

  Dox.ApiError = DoxApiError;
  Dox.api = {
    deviceId,
    translate,
    fawFingerprint,
    submitFaw,
    deleteFaw,
    stt,
  };
})();
