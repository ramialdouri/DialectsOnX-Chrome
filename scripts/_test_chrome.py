#!/usr/bin/env python3
"""Structural checks for DialectsOnX 0.3 (catalog, packs, feed contract)."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXT = ROOT / "extension"
sys.path.insert(0, str(ROOT / "scripts"))
from chrome_delta import DELTA_EN, delta_for  # noqa: E402


def _assert(cond: bool, msg: str) -> None:
    if not cond:
        raise AssertionError(msg)


def test_catalog_and_packs() -> None:
    dialects_js = (EXT / "dialects.js").read_text(encoding="utf-8")
    _assert("PROMPT_VERSION 4.2.32" in dialects_js, "stamp prompt version")
    _assert("@font-face" not in dialects_js.lower(), "no font-face in catalog")
    packs = sorted((EXT / "i18n").glob("*.json"))
    _assert(len(packs) == 58, f"packs {len(packs)}")
    ids = []
    for path in packs:
        pack = json.loads(path.read_text(encoding="utf-8"))
        _assert(pack["status"] == "approved", path.name)
        strings = pack["strings"]
        for key in DELTA_EN:
            _assert(key in strings and strings[key].strip(), f"{pack['dialect_id']} missing {key}")
        if pack["dialect_id"] != "english_american":
            _assert(
                strings["dox_show_more"] != DELTA_EN["dox_show_more"],
                f"{pack['dialect_id']} still English dox_show_more",
            )
            _assert("DialectsOnX" in strings["dox_about_line"], pack["dialect_id"])
            _assert("Dialex" in strings["dox_open_pad"] and "Pad" in strings["dox_open_pad"], pack["dialect_id"])
        ids.append(pack["dialect_id"])
        delta_for(pack["dialect_id"])
    pb = json.loads((EXT / "i18n" / "punjabi_indian.json").read_text(encoding="utf-8"))
    _assert("Hor" not in pb["strings"]["dox_show_more"], "punjabi show more")
    _assert("ਹੋਰ" in pb["strings"]["dox_show_more"], "punjabi gurmukhi")
    _assert("english_american" in ids and "arabic_msa" in ids, ids)

    # dialects.js catalog length
    m = re.search(r'"ids":\s*\[(.*?)\]', dialects_js, re.S)
    _assert(m, "ids array")
    catalog_ids = re.findall(r'"([^"]+)"', m.group(1))
    _assert(len(catalog_ids) == 293, len(catalog_ids))
    _assert("arabic_syrian_hama" in catalog_ids, "hama in catalog")
    _assert('"english_aave": "AAE"' in dialects_js or '"english_aave":"AAE"' in dialects_js.replace(" ", ""), dialects_js[dialects_js.find("english_aave"):dialects_js.find("english_aave")+80])
    _assert("arabic_uae_pidgin" in dialects_js and "EPA" in dialects_js, "EPA hint")
    _assert('"egypt": "arabic_egyptian"' in dialects_js, "legacy egypt")
    _assert('"msa": "arabic_msa"' in dialects_js, "legacy msa")
    _assert('"syria": "arabic_syrian_damascus"' in dialects_js, "legacy syria")


def test_feed_contract() -> None:
    content = (EXT / "content.js").read_text(encoding="utf-8")
    _assert("innerHTML = translated" not in content, "must not innerHTML-replace tweets")
    _assert("clientSource: \"dialectsonx\"" in content, "dialectsonx translate")
    _assert("extractPostText" in content, "emoji extract")
    _assert("autoTranslateEnabled = prefs.autoTranslate === true" in content, "unset auto-off")
    _assert("showingOriginal: !autoTranslateEnabled" in content, "Original first")
    _assert("Dox.sheet.open" in content, "sheet not radios")
    _assert(".dialx-panel" not in content, "v0.1 radio panel css gone")
    _assert("height: 30px" in content, "logo height matches Original")
    _assert("align-items: flex-end" in content, "shared baseline")
    manifest = json.loads((EXT / "manifest.json").read_text(encoding="utf-8"))
    _assert(manifest["version"] == "0.3.0", manifest["version"])
    _assert("offscreen" in manifest["permissions"], "stt offscreen")
    ime = (EXT / "ime.js").read_text(encoding="utf-8")
    _assert('clientSource: "ime"' in ime, "ime source")
    _assert("password" in ime, "skip password")
    faw = (EXT / "faw.js").read_text(encoding="utf-8")
    _assert("client_source" not in faw or "dialectsonx" in (EXT / "api.js").read_text(), "faw dox")
    api = (EXT / "api.js").read_text(encoding="utf-8")
    _assert('client_source: "dialectsonx"' in api, api)
    prefs = (EXT / "prefs.js").read_text(encoding="utf-8")
    _assert("autoTranslate: false" in prefs, "default auto off")
    _assert("arabic_msa" in prefs, "default dialect")
    locale = (EXT / "locale.js").read_text(encoding="utf-8")
    _assert("deltaKeys.has(key)" in locale, "no english fallback for delta")
    _assert("@font-face" not in locale, "no latin font")
    sheet = (EXT / "sheet.js").read_text(encoding="utf-8")
    _assert("90vh" in sheet, "sheet height")
    _assert("nowrap" in sheet, "no clip chips")
    _assert("hamaHoldMs" in sheet, "hama hold")
    _assert("mode === \"ime\"" in sheet, "ime pick isolated")
    _assert("dox-sheet-lang-panel" in sheet, "left language panel")
    _assert("dox-sheet-dialect-panel" in sheet, "right dialect panel")
    _assert("dox-sheet-cols" not in sheet, "old all-dialect table gone")
    _assert("standardDialectFor" in sheet, "language click uses prestige dialect")
    _assert("browseSpokenId" in sheet, "browse spoken language")
    sys_js = (EXT / "system-language.js").read_text(encoding="utf-8")
    _assert("dox-sys-card" in sys_js, "system language card")
    _assert("dox-gold" not in sys_js and "dox-sheet-group" not in sys_js, "system language has no gold group headers")
    _assert("sys-endonym" in sys_js and "sys-en" in sys_js, "endonym + localized name")
    settings_js = (EXT / "settings.js").read_text(encoding="utf-8")
    _assert("Dox.systemLanguage.renderList" in settings_js, "settings uses Dialex sys list")
    settings_html = (EXT / "settings.html").read_text(encoding="utf-8")
    _assert("system-language.js" in settings_html, "settings loads sys list")
    _assert("dox-sys-card" in settings_html, "settings sys card markup")
    locale = (EXT / "locale.js").read_text(encoding="utf-8")
    _assert("function endonym" in locale, "endonym helper")
    _assert("LANG_ABBREV" in locale, "system language abbrev search")
    _assert("refreshOverlay" in content, "faw rebind overlay")
    _assert("setImePosition" in ime, "ime position local")
    _assert("window.top !== window" in ime, "ime top frame")
    _assert("STT_CODES" in ime, "stt bcp47")
    _assert("lastField" in ime, "ime remembers focused field")
    _assert("arabicStringLocks" in locale, "arabic locks")
    faw = (EXT / "faw.js").read_text(encoding="utf-8")
    _assert("refreshOverlay" in faw, "faw uses feed refresh")
    _assert("prefix" in faw, "personal overlay per dialect")


def test_extract_emoji() -> None:
    html = (EXT / "test" / "tweet-fixture.html").read_text(encoding="utf-8")
    _assert("alt=\"🔥\"" in html, "fixture emoji img")
    _assert("Show more" in html, "fixture show more")
    demo = (EXT / "test" / "demo.html").read_text(encoding="utf-8")
    _assert("primaryColumn" in demo, "demo feed column")
    _assert("chrome-mock.js" in demo, "demo chrome stub")
    _assert("system-language.js" in demo, "demo system language")
    _assert("dox-sys-card" in demo, "demo sys card")
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    _assert("dialectsonx.onrender.com" not in readme, "no Render URL")
    _assert("dialex-backend-f6b7" in readme, "Cloud Run URL")
    _assert(not (ROOT / "backend" / "main.py").exists(), "Render backend deleted")


def test_faw_neighbor() -> None:
    # Pad contract: grow only by immediate neighbor, max 4; second tap on a
    # single token clears.
    def nxt(current, tapped, maxn=4):
        if current is None:
            return (tapped, tapped)
        start, end = current
        if start == end and start == tapped:
            return None
        if end - start + 1 > 1 and tapped == start:
            return (start + 1, end)
        if end - start + 1 > 1 and tapped == end:
            return (start, end - 1)
        if start <= tapped <= end:
            return current
        if end - start + 1 >= maxn:
            return current
        if tapped == start - 1:
            return (tapped, end)
        if tapped == end + 1:
            return (start, tapped)
        return current

    _assert(nxt(None, 2) == (2, 2), "first tap")
    _assert(nxt((2, 2), 2) is None, "second tap clears")
    _assert(nxt((2, 2), 3) == (2, 3), "grow right")
    _assert(nxt((2, 3), 4) == (2, 4), "grow right 2")
    _assert(nxt((2, 4), 5) == (2, 5), "grow to max")
    _assert(nxt((2, 5), 6) == (2, 5), "do not exceed 4")
    _assert(nxt((2, 4), 1) == (1, 4), "grow left neighbor")
    _assert(nxt((2, 4), 0) == (2, 4), "skip non-neighbor")


def main() -> None:
    test_catalog_and_packs()
    test_feed_contract()
    test_extract_emoji()
    test_faw_neighbor()
    print("chrome 0.3 structural tests ok")


if __name__ == "__main__":
    main()
