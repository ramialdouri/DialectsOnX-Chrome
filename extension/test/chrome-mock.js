/* Minimal chrome.* stub so popup/settings/sheet/IME/feed can run as a local page. */
(function () {
  const sync = {};
  const local = { deviceId: "demo-device" };
  const listeners = [];

  function storeGet(bucket) {
    return (keys, cb) => {
      const out = {};
      if (keys == null) Object.assign(out, bucket);
      else if (Array.isArray(keys)) keys.forEach((k) => { if (k in bucket) out[k] = bucket[k]; });
      else if (typeof keys === "object") Object.assign(out, keys, bucket);
      else if (keys in bucket) out[keys] = bucket[keys];
      cb(out);
    };
  }
  function storeSet(bucket, area) {
    return (patch, cb) => {
      Object.assign(bucket, patch);
      listeners.forEach((fn) => {
        const changes = {};
        for (const [k, v] of Object.entries(patch)) changes[k] = { newValue: v };
        fn(changes, area);
      });
      cb?.();
    };
  }

  const root = new URL("../", document.currentScript.src);
  globalThis.chrome = {
    runtime: {
      id: "dox-demo",
      lastError: null,
      getURL(path) {
        return new URL(path, root).href;
      },
      sendMessage() {
        return Promise.resolve({ ok: true });
      },
      onMessage: { addListener() {} },
      getContexts: async () => [],
    },
    storage: {
      sync: {
        get: storeGet(sync),
        set: storeSet(sync, "sync"),
      },
      local: {
        get: storeGet(local),
        set: storeSet(local, "local"),
        remove(keys, cb) {
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete local[k]);
          cb?.();
        },
      },
      onChanged: {
        addListener(fn) {
          listeners.push(fn);
        },
      },
    },
    offscreen: { createDocument: async () => {} },
    tabs: { query: (q, cb) => cb([]), sendMessage: async () => {} },
  };

  const origFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (url, opts = {}) => {
    const href = String(url);
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    if (href.includes("/faw/fingerprint")) return json({ fingerprint: "demo-fp" });
    if (href.includes("/translate") && (opts.method || "GET").toUpperCase() === "POST") {
      const body = JSON.parse(opts.body || "{}");
      return json({
        translation: "[" + (body.target_dialect || "dialect") + "] " + (body.text || ""),
        transliteration: "",
        cached: false,
      });
    }
    if (href.includes("/faw") && (opts.method || "GET").toUpperCase() === "POST") {
      return json({ ok: true, promoted: false });
    }
    if (href.includes("/faw") && (opts.method || "").toUpperCase() === "DELETE") {
      return json({ ok: true });
    }
    return origFetch(url, opts);
  };
})();
