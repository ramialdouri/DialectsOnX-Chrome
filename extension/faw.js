/* Fix A Word on X translation overlays — same Pad store via client_source dialectsonx. */
globalThis.Dox = globalThis.Dox || {};

(function () {
  if (Dox.faw) return;
  const MAX = 4;
  const WORD = /[\p{L}\p{N}]+/gu;

  function tokenize(text) {
    const tokens = [];
    const re = new RegExp(WORD.source, "gu");
    let m;
    while ((m = re.exec(text))) {
      tokens.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    }
    return tokens;
  }

  function nextSelection(current, tapped) {
    if (!current) return { start: tapped, end: tapped };
    if (current.start === current.end && current.start === tapped) return null;
    if (current.end - current.start + 1 > 1 && tapped === current.start) {
      return { start: current.start + 1, end: current.end };
    }
    if (current.end - current.start + 1 > 1 && tapped === current.end) {
      return { start: current.start, end: current.end - 1 };
    }
    if (tapped >= current.start && tapped <= current.end) return current;
    if (current.end - current.start + 1 >= MAX) return current;
    if (tapped === current.start - 1) return { start: tapped, end: current.end };
    if (tapped === current.end + 1) return { start: current.start, end: tapped };
    return current;
  }

  function spanText(text, tokens, sel) {
    if (!sel || !tokens.length) return "";
    return text.slice(tokens[sel.start].start, tokens[sel.end].end);
  }

  async function personalMap() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["fawPersonal"], (data) => resolve(data.fawPersonal || {}));
    });
  }

  async function savePersonal(dialectId, original, correction, transliteration) {
    const map = await personalMap();
    const key = dialectId + "\n" + original;
    map[key] = { original, correction, transliteration: transliteration || "" };
    await chrome.storage.local.set({ fawPersonal: map });
  }

  async function applyPersonal(dialectId, text) {
    const map = await personalMap();
    const prefix = dialectId ? dialectId + "\n" : "";
    let out = text;
    for (const [key, item] of Object.entries(map)) {
      if (prefix && !key.startsWith(prefix)) continue;
      if (!item?.original || !item?.correction) continue;
      if (out.includes(item.original)) out = out.split(item.original).join(item.correction);
    }
    return out;
  }

  function injectFawStyles() {
    if (document.getElementById("dox-faw-styles")) return;
    const style = document.createElement("style");
    style.id = "dox-faw-styles";
    style.textContent = `
      .dox-faw-hi { background: rgba(224,184,58,.38); border-radius: 3px; }
      .dox-faw-chip {
        position: fixed; z-index: 2147482500;
        background: #E0B83A; color: #3D2A08; border: 0; border-radius: 999px;
        font: 600 12px ${Dox.FONT}; padding: 3px 10px; cursor: pointer;
      }
      .dox-faw-dlg {
        position: fixed; inset: 0; z-index: 2147483600; background: rgba(0,0,0,.45);
        display: flex; align-items: center; justify-content: center;
        font-family: ${Dox.FONT};
      }
      .dox-faw-card {
        background: #16181c; color: #e7e9ea; border: 1px solid #2f3336;
        border-radius: 14px; padding: 16px; width: min(360px, calc(100vw - 24px));
        display: flex; flex-direction: column; gap: 8px;
      }
      .dox-faw-card input, .dox-faw-card button {
        font: inherit; border-radius: 8px; padding: 8px 10px;
      }
      .dox-faw-card input {
        background: #0f1113; border: 1px solid #2f3336; color: #e7e9ea;
      }
      .dox-faw-save { background: #E0B83A; color: #3D2A08; border: 0; font-weight: 700; cursor: pointer; }
      .dox-faw-skip { background: transparent; border: 1px solid #2f3336; color: #8b98a5; cursor: pointer; }
    `;
    document.documentElement.appendChild(style);
  }

  function hitIndex(el, tokens, clientX, clientY) {
    const textNode = firstText(el);
    if (!textNode || !document.caretRangeFromPoint) return -1;
    const range = document.caretRangeFromPoint(clientX, clientY);
    if (!range || !el.contains(range.startContainer)) return -1;
    const pre = document.createRange();
    pre.selectNodeContents(el);
    try {
      pre.setEnd(range.startContainer, range.startOffset);
    } catch {
      return -1;
    }
    const offset = pre.toString().length;
    for (let i = 0; i < tokens.length; i++) {
      if (offset >= tokens[i].start && offset <= tokens[i].end) return i;
    }
    return -1;
  }

  function firstText(el) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    return w.nextNode();
  }

  function highlight(el, text, tokens, sel) {
    el.querySelectorAll(".dox-faw-hi").forEach((n) => {
      n.replaceWith(document.createTextNode(n.textContent));
    });
    el.normalize();
    if (!sel) return;
    const span = spanText(text, tokens, sel);
    if (!span) return;
    const idx = el.textContent.indexOf(span);
    if (idx < 0) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let acc = 0;
    let node;
    while ((node = walker.nextNode())) {
      const next = acc + node.length;
      if (idx >= acc && idx < next) {
        const local = idx - acc;
        const end = Math.min(node.length, local + span.length);
        const range = document.createRange();
        range.setStart(node, local);
        range.setEnd(node, end);
        const mark = document.createElement("span");
        mark.className = "dox-faw-hi";
        range.surroundContents(mark);
        return;
      }
      acc = next;
    }
  }

  function openDialog({ original, dialectId, sourceText, translationText, onSaved }) {
    injectFawStyles();
    const needsPhonetic = Dox.spokenIdOf(dialectId) !== "english";
    const dlg = document.createElement("div");
    dlg.className = "dox-faw-dlg";
    Dox.locale.applyDir(dlg);
    const card = document.createElement("div");
    card.className = "dox-faw-card";
    const title = document.createElement("div");
    title.textContent = Dox.locale.t("pad_faw_dialog_title");
    const input = document.createElement("input");
    input.value = original;
    input.setAttribute("aria-label", Dox.locale.t("pad_faw_correction_label"));
    const save = document.createElement("button");
    save.type = "button";
    save.className = "dox-faw-save";
    save.textContent = Dox.locale.t("pad_faw_save");
    const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "dox-faw-skip";
    skip.textContent = Dox.locale.t("settings_cancel");
    card.append(title, input, save, skip);
    dlg.appendChild(card);
    const close = () => dlg.remove();
    skip.addEventListener("click", close);
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) close();
    });

    async function submit(correction, transliteration) {
      if (!correction || correction === original) {
        close();
        return;
      }
      await savePersonal(dialectId, original, correction, transliteration);
      try {
        await Dox.api.submitFaw({
          dialect_id: dialectId,
          original,
          correction,
          transliteration: transliteration || "",
          source_text: sourceText || "",
          translation_text: translationText || "",
        });
      } catch (e) {
        console.warn("FAW submit failed", e);
      }
      close();
      onSaved?.(correction);
    }

    save.addEventListener("click", async () => {
      const correction = input.value.trim();
      if (!needsPhonetic) {
        await submit(correction, "");
        return;
      }
      card.replaceChildren();
      const ptitle = document.createElement("div");
      ptitle.textContent = Dox.locale.t("pad_faw_phonetic_title");
      const phon = document.createElement("input");
      phon.setAttribute("aria-label", Dox.locale.t("pad_faw_transliteration_label"));
      const ps = document.createElement("button");
      ps.type = "button";
      ps.className = "dox-faw-save";
      ps.textContent = Dox.locale.t("pad_faw_save");
      const sk = document.createElement("button");
      sk.type = "button";
      sk.className = "dox-faw-skip";
      sk.textContent = Dox.locale.t("pad_faw_skip");
      card.append(ptitle, phon, ps, sk);
      ps.addEventListener("click", () => submit(correction, phon.value.trim()));
      sk.addEventListener("click", () => submit(correction, ""));
    });
    document.documentElement.appendChild(dlg);
    input.focus();
  }

  function bindOverlay(state) {
    const el = state?.transEl;
    if (!el || el.dataset.doxFawBound === "1") return;
    el.dataset.doxFawBound = "1";
    injectFawStyles();
    let sel = null;
    let chip = null;

    function clearChip() {
      chip?.remove();
      chip = null;
    }

    el.addEventListener("dblclick", async (e) => {
      const prefs = await Dox.prefs.get();
      if (!prefs.fawEnabled || !prefs.extensionEnabled) return;
      if (state.showingOriginal) return;
      const text = state.overlayText || el.textContent || "";
      const tokens = tokenize(text);
      const idx = hitIndex(el, tokens, e.clientX, e.clientY);
      if (idx < 0) return;
      e.preventDefault();
      e.stopPropagation();
      sel = nextSelection(sel, idx);
      highlight(el, text, tokens, sel);
      clearChip();
      if (!sel) return;
      chip = document.createElement("button");
      chip.type = "button";
      chip.className = "dox-faw-chip";
      chip.textContent = Dox.locale.t("pad_faw_chip");
      chip.style.left = e.clientX + "px";
      chip.style.top = Math.max(8, e.clientY - 28) + "px";
      chip.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const original = spanText(text, tokens, sel);
        openDialog({
          original,
          dialectId: state.activeDialect || Dox.migrateDialectId(prefs.preferredDialect),
          sourceText: state.originalText,
          translationText: text,
          onSaved: async () => {
            const next = await applyPersonal(state.activeDialect, text);
            state.overlayText = next;
            if (state.translationCache) {
              for (const [k, v] of state.translationCache) {
                if (v === text) state.translationCache.set(k, next);
              }
            }
            if (typeof Dox.feed?.refreshOverlay === "function") {
              Dox.feed.refreshOverlay(state);
            } else if (state.transEl) {
              state.transEl.textContent = next;
              state.transEl.dataset.doxFawBound = "";
              bindOverlay(state);
            }
            sel = null;
            clearChip();
          },
        });
      });
      document.documentElement.appendChild(chip);
    });
    document.addEventListener("click", (e) => {
      if (chip && !chip.contains(e.target) && !el.contains(e.target)) {
        sel = null;
        highlight(el, state.overlayText || "", tokenize(state.overlayText || ""), null);
        clearChip();
      }
    });
  }

  async function clearPersonal() {
    await chrome.storage.local.set({ fawPersonal: {} });
    try {
      await Dox.api.deleteFaw();
    } catch (_) {
      /* ignore */
    }
  }

  Dox.faw = { bindOverlay, applyPersonal, clearPersonal, tokenize, nextSelection };
})();
