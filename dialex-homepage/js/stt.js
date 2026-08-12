/**
 * Dialex STT: record with MediaRecorder, then send 16 kHz mono WAV PCM16.
 * Chrome captures webm/opus, which xAI /stt rejects. Android Pad sends
 * 16 kHz mono AAC. This helper matches that sample rate in a WAV container.
 */
(function (root) {
  const TARGET_RATE = 16000;
  const MIN_DURATION_SEC = 0.12;
  const SUPPORTED = new Set([
    "ar",
    "cs",
    "da",
    "nl",
    "en",
    "fil",
    "fr",
    "de",
    "hi",
    "id",
    "it",
    "ja",
    "ko",
    "mk",
    "ms",
    "fa",
    "pl",
    "pt",
    "ro",
    "ru",
    "es",
    "sv",
    "th",
    "tr",
    "vi",
  ]);

  function languageFromNavigator(nav) {
    const source = nav || (typeof navigator !== "undefined" ? navigator : null);
    const tag = String(source?.language || "en").toLowerCase();
    const primary = tag.split(/[-_]/)[0];
    const mapped = primary === "tl" ? "fil" : primary === "in" ? "id" : primary;
    return SUPPORTED.has(mapped) ? mapped : "en";
  }

  function recorderMime() {
    if (typeof MediaRecorder === "undefined") return "";
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];
    return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  }

  function mixdownMono(buffer) {
    const length = buffer.length;
    const channels = buffer.numberOfChannels;
    const out = new Float32Array(length);
    if (channels === 1) {
      out.set(buffer.getChannelData(0));
      return out;
    }
    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (let c = 0; c < channels; c++) sum += buffer.getChannelData(c)[i];
      out[i] = sum / channels;
    }
    return out;
  }

  function resampleLinear(input, fromRate, toRate) {
    if (fromRate === toRate) return input;
    const ratio = fromRate / toRate;
    const outLen = Math.max(1, Math.round(input.length / ratio));
    const out = new Float32Array(outLen);
    const last = input.length - 1;
    for (let i = 0; i < outLen; i++) {
      const pos = i * ratio;
      const i0 = Math.min(Math.floor(pos), last);
      const i1 = Math.min(i0 + 1, last);
      const frac = pos - i0;
      out[i] = input[i0] * (1 - frac) + input[i1] * frac;
    }
    return out;
  }

  function encodeWavPcm16(samples, sampleRate) {
    const dataSize = samples.length * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    function writeString(offset, text) {
      for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    }
    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, dataSize, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([buffer], { type: "audio/wav" });
  }

  function createDecodeContext() {
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) throw new Error("Could not process the recording.");
    try {
      return new AC({ sampleRate: TARGET_RATE });
    } catch {
      return new AC();
    }
  }

  async function blobToWav(blob) {
    const ctx = createDecodeContext();
    try {
      if (ctx.state === "suspended" && ctx.resume) await ctx.resume();
      const copy = await blob.arrayBuffer();
      const decoded = await ctx.decodeAudioData(copy.slice(0));
      if (!decoded || decoded.duration < MIN_DURATION_SEC) {
        throw new Error("No audio captured.");
      }
      const mono = mixdownMono(decoded);
      const samples = resampleLinear(mono, decoded.sampleRate, TARGET_RATE);
      return encodeWavPcm16(samples, TARGET_RATE);
    } finally {
      if (ctx.close) {
        try {
          await ctx.close();
        } catch (_) {}
      }
    }
  }

  function errorCode(payload) {
    if (!payload || typeof payload !== "object") return "";
    const detail = payload.detail;
    if (detail && typeof detail === "object" && typeof detail.error === "string") {
      return detail.error;
    }
    if (typeof payload.error === "string") return payload.error;
    if (typeof detail === "string") return detail;
    return "";
  }

  function friendlyHttpError(status, payload) {
    const code = errorCode(payload);
    if (code === "empty_file") return "No audio captured.";
    if (status === 413) return "Recording is too long.";
    if (status === 0 || status === 408) return "Could not reach Dialex.";
    return "Transcription failed.";
  }

  async function transcribe({ backendUrl, blob, language }) {
    if (!blob || !blob.size) throw new Error("No audio captured.");
    let wav;
    try {
      wav = await blobToWav(blob);
    } catch (err) {
      if (err && err.message === "No audio captured.") throw err;
      throw new Error("Could not process the recording.");
    }
    if (!wav.size) throw new Error("No audio captured.");

    const base = String(backendUrl || "").replace(/\/$/, "");
    const form = new FormData();
    form.append("file", wav, "audio.wav");
    form.append("language", language || languageFromNavigator());

    let res;
    try {
      res = await fetch(`${base}/stt`, { method: "POST", body: form });
    } catch {
      throw new Error("Could not reach Dialex.");
    }

    let payload = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }

    if (!res.ok) throw new Error(friendlyHttpError(res.status, payload));

    const text = String(payload?.text || payload?.transcript || "").trim();
    if (!text) throw new Error("No speech detected.");
    return {
      text,
      language: payload.language || language || languageFromNavigator(),
    };
  }

  root.DialexStt = {
    languageFromNavigator,
    recorderMime,
    transcribe,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
