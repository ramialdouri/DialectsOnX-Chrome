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

  const LRI = "\u2066";
  const PDI = "\u2069";
  const ISOLATE_OPEN = new Set(["\u2066", "\u2067", "\u2068"]);
  const RTL_RE =
    /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  const URL_BODY = "[A-Za-z0-9._~:/?#\\[\\]@!$&'()*+,;=%\\-]+";
  const ISLAND_RE = new RegExp(
    "(https?://" +
      URL_BODY +
      "|www\\." +
      URL_BODY +
      "|(?:x\\.com|t\\.co|youtu\\.be)/" +
      URL_BODY +
      ")" +
      "|(\\$[A-Za-z0-9]+(?:[.,][A-Za-z0-9]+)*)" +
      "|(@[A-Za-z0-9_]+)" +
      "|(#[A-Za-z0-9_]+)" +
      "|([A-Za-z][A-Za-z0-9'’_\\-]*(?:[ \\t]+[A-Za-z][A-Za-z0-9'’_\\-]*)*(?:\\.[A-Za-z][A-Za-z0-9'’_\\-]*)*)",
    "gi"
  );
  const LATIN_WORD_INNER_RE = new RegExp(
    "^[A-Za-z][A-Za-z0-9'’_\\-]*(?:[ \\t]+[A-Za-z][A-Za-z0-9'’_\\-]*)*(?:\\.[A-Za-z][A-Za-z0-9'’_\\-]*)*$",
    "i"
  );
  const ADJACENT_LRI_RE =
    /\u2066([^\u2066\u2069]*)\u2069([ \t]+)\u2066([^\u2066\u2069]*)\u2069/g;
  const URL_TRAIL_PUNCT = new Set(".,;:!?".split(""));
  const URL_TRAIL_BRACKETS = new Set(")]}".split(""));

  function containsRtlScript(text) {
    return Boolean(text) && RTL_RE.test(text);
  }

  function isolateDepths(text) {
    const depths = new Array(text.length).fill(0);
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
      depths[i] = depth;
      const ch = text[i];
      if (ISOLATE_OPEN.has(ch)) depth += 1;
      else if (ch === PDI && depth) depth -= 1;
    }
    return depths;
  }

  function trimUrl(url) {
    let s = url;
    while (s && URL_TRAIL_PUNCT.has(s[s.length - 1])) s = s.slice(0, -1);
    while (s && URL_TRAIL_BRACKETS.has(s[s.length - 1])) {
      if (s[s.length - 1] === ")" && (s.split("(").length - 1) >= (s.split(")").length - 1)) break;
      s = s.slice(0, -1);
    }
    return s;
  }

  function isLatinWordIsland(inner) {
    return Boolean(inner) && LATIN_WORD_INNER_RE.test(inner);
  }

  function mergeAdjacentLatinWordIslands(text) {
    let out = text;
    let prev = null;
    while (out !== prev) {
      prev = out;
      ADJACENT_LRI_RE.lastIndex = 0;
      out = out.replace(ADJACENT_LRI_RE, (all, left, gap, right) => {
        if (isLatinWordIsland(left) && isLatinWordIsland(right)) {
          return LRI + left + gap + right + PDI;
        }
        return all;
      });
    }
    return out;
  }

  function wrapRtlLatinIslands(text) {
    if (!text || !containsRtlScript(text)) return text;
    const depths = isolateDepths(text);
    const spans = [];
    ISLAND_RE.lastIndex = 0;
    let m;
    while ((m = ISLAND_RE.exec(text))) {
      let start = m.index;
      let end = start + m[0].length;
      if (m[1]) end = start + trimUrl(text.slice(start, end)).length;
      if (start >= end) continue;
      if (depths[start] > 0) continue;
      if (start > 0 && text[start - 1] === LRI && end < text.length && text[end] === PDI) {
        continue;
      }
      spans.push([start, end]);
    }
    let out = text;
    for (let i = spans.length - 1; i >= 0; i--) {
      const [start, end] = spans[i];
      out = out.slice(0, start) + LRI + out.slice(start, end) + PDI + out.slice(end);
    }
    return mergeAdjacentLatinWordIslands(out);
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
    signal,
    fingerprint,
  }) {
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
        formality: "auto",
        speaker_gender: "unknown",
        previous_turn: "",
      },
    });
    return {
      translation: wrapRtlLatinIslands(body.translation || ""),
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
    wrapRtlLatinIslands,
    fawFingerprint,
    submitFaw,
    deleteFaw,
    stt,
  };
})();
