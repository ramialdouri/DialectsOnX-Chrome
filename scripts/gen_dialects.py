#!/usr/bin/env python3
"""Generate DialectsOnX catalog JS + copy/merge System Language packs from Dialex-Android."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANDROID_ROOT = Path("/agent/repos/dialex-android")
ANDROID_BACKEND = ANDROID_ROOT / "backend"
PACKS_SRC = ANDROID_BACKEND / "app" / "i18n" / "packs"
EXT = ROOT / "extension"
I18N_OUT = EXT / "i18n"
DIALECTS_JS = EXT / "dialects.js"

sys.path.insert(0, str(ANDROID_BACKEND))
sys.path.insert(0, str(ROOT / "scripts"))

from app.dialects.catalog import (  # noqa: E402
    DIALECT_DISPLAY_NAMES,
    DIALECT_INFO_HINTS,
)
from app.dialects.spoken import (  # noqa: E402
    DIALECT_SPOKEN_LANGUAGE,
    LANGUAGE_GROUPS,
    SPOKEN_LANGUAGES,
    dialects_for_spoken,
)
from app.dialects.system_locale import (  # noqa: E402
    LANGUAGE_ENDONYMS,
    OS_LANGUAGE_TO_SPOKEN,
    OS_LOCALE_TO_DIALECT,
    dialect_from_os_locale,
    rtl_dialect_ids,
    standard_dialect_for,
    standard_dialect_map,
)
from app.i18n import ARABIC_STRING_LOCKS, CHROME_CHIP_LOCKS, FROZEN_KEYS  # noqa: E402
from app.prompts.base import PROMPT_VERSION  # noqa: E402
from chrome_delta import DELTA_EN, delta_for  # noqa: E402

HIDDEN_UNTIL_UNLOCKED = ("arabic_syrian_hama",)
HAMA_UNLOCK_HOLD_MS = 5000
MAX_FAVORITES = 12
MAX_RECENTS = 8

LEGACY_IDS = {
    "msa": "arabic_msa",
    "uae": "arabic_emirati",
    "saudi_najdi": "arabic_saudi_najdi",
    "saudi_hijazi": "arabic_saudi_hijazi",
    "kuwait": "arabic_kuwaiti",
    "qatar": "arabic_qatari",
    "syria": "arabic_syrian_damascus",
    "lebanon": "arabic_lebanese",
    "jordan": "arabic_jordanian",
    "palestine": "arabic_palestinian",
    "iraq": "arabic_iraqi",
    "egypt": "arabic_egyptian",
    "sudan": "arabic_sudanese",
    "morocco": "arabic_moroccan",
    "algeria": "arabic_algerian",
    "tunisia": "arabic_tunisian",
    "ar_msa": "arabic_msa",
}

GROK_DIALECT_SUFFIX = (
    "english_cockney",
    "english_manc",
    "english_scouse",
    "english_geordie",
    "english_chicano",
    "armenian_yerevan",
)
GROK_LANGUAGE_SUFFIX = (
    "french_seselwa",
    "french_ivorian",
    "filipino_tagalog",
    "filipino_cebuano",
    "filipino_ilocano",
    "filipino_hiligaynon",
    "filipino_waray",
    "bengali_standard",
    "marathi_standard",
    "armenian_western",
)
GROK_PROMPT_OVERRIDE = {
    "english_aave": "African American English",
}


def android_sha() -> str:
    try:
        return (
            subprocess.check_output(
                ["git", "rev-parse", "HEAD"],
                cwd=ANDROID_ROOT,
                text=True,
            ).strip()
        )
    except subprocess.CalledProcessError:
        return "unknown"


def js_literal(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def catalog_groups() -> list[dict]:
    groups = []
    for gid, glabel in LANGUAGE_GROUPS.items():
        spoken_rows = []
        for sid, (group_id, slabel) in SPOKEN_LANGUAGES.items():
            if group_id != gid:
                continue
            dialects = []
            for did in dialects_for_spoken(sid):
                dialects.append(
                    {
                        "id": did,
                        "chip": DIALECT_DISPLAY_NAMES[did],
                        "hint": DIALECT_INFO_HINTS.get(did, ""),
                        "hidden": did in HIDDEN_UNTIL_UNLOCKED,
                    }
                )
            spoken_rows.append(
                {
                    "id": sid,
                    "label": slabel,
                    "endonym": LANGUAGE_ENDONYMS.get(sid, slabel),
                    "standard": standard_dialect_for(sid),
                    "dialects": dialects,
                }
            )
        groups.append({"id": gid, "label": glabel, "languages": spoken_rows})
    return groups


def write_dialects_js() -> None:
    sha = android_sha()
    payload = {
        "androidSha": sha,
        "promptVersion": PROMPT_VERSION,
        "displayNames": DIALECT_DISPLAY_NAMES,
        "infoHints": DIALECT_INFO_HINTS,
        "spokenOf": DIALECT_SPOKEN_LANGUAGE,
        "languageGroups": LANGUAGE_GROUPS,
        "spokenLanguages": {sid: {"group": g, "label": lab} for sid, (g, lab) in SPOKEN_LANGUAGES.items()},
        "endonyms": LANGUAGE_ENDONYMS,
        "standardDialect": standard_dialect_map(),
        "rtlIds": rtl_dialect_ids(),
        "osLocaleToDialect": OS_LOCALE_TO_DIALECT,
        "osLanguageToSpoken": OS_LANGUAGE_TO_SPOKEN,
        "frozenKeys": sorted(FROZEN_KEYS),
        "chromeChipLocks": CHROME_CHIP_LOCKS,
        "arabicStringLocks": ARABIC_STRING_LOCKS,
        "legacyIds": LEGACY_IDS,
        "hiddenUntilUnlocked": list(HIDDEN_UNTIL_UNLOCKED),
        "hamaHoldMs": HAMA_UNLOCK_HOLD_MS,
        "maxFavorites": MAX_FAVORITES,
        "maxRecents": MAX_RECENTS,
        "deltaKeys": sorted(DELTA_EN),
        "grokDialectSuffix": list(GROK_DIALECT_SUFFIX),
        "grokLanguageSuffix": list(GROK_LANGUAGE_SUFFIX),
        "grokPromptOverride": GROK_PROMPT_OVERRIDE,
        "groups": catalog_groups(),
        "ids": list(DIALECT_DISPLAY_NAMES),
    }
    DIALECTS_JS.write_text(
        "/* Generated by scripts/gen_dialects.py — do not edit by hand. */\n"
        f"/* Android SHA {sha} PROMPT_VERSION {PROMPT_VERSION} */\n"
        "globalThis.Dox = globalThis.Dox || {};\n"
        "if (!Dox.CATALOG) {\n"
        f"Dox.CATALOG = {js_literal(payload)};\n"
        """
Dox.migrateDialectId = function (id) {
  const raw = String(id || "").trim();
  if (!raw) return "arabic_msa";
  const mapped = Dox.CATALOG.legacyIds[raw] || raw;
  return Dox.CATALOG.displayNames[mapped] ? mapped : "arabic_msa";
};
Dox.isValidDialect = function (id) {
  return Boolean(Dox.CATALOG.displayNames[id]);
};
Dox.isRtlDialect = function (id) {
  return Dox.CATALOG.rtlIds.indexOf(id) >= 0;
};
Dox.standardDialectFor = function (spokenId) {
  return Dox.CATALOG.standardDialect[spokenId] || "english_american";
};
Dox.dialectFromOsLocale = function (tag) {
  const raw = String(tag || "").trim().replace(/_/g, "-").toLowerCase();
  if (!raw) return "english_american";
  const parts = raw.split("-").filter(Boolean);
  const candidates = [raw];
  if (parts.length >= 2) {
    candidates.push(parts[0] + "-" + parts[parts.length - 1]);
    candidates.push(parts.slice(0, 2).join("-"));
  }
  candidates.push(parts[0]);
  const seen = {};
  for (const cand of candidates) {
    if (seen[cand]) continue;
    seen[cand] = true;
    const mapped = Dox.CATALOG.osLocaleToDialect[cand];
    if (mapped) {
      const spoken = Dox.CATALOG.spokenOf[mapped];
      if (spoken) return Dox.standardDialectFor(spoken);
    }
    const spoken = Dox.CATALOG.osLanguageToSpoken[cand];
    if (spoken) return Dox.standardDialectFor(spoken);
  }
  return "english_american";
};
Dox.spokenIdOf = function (dialectId) {
  return Dox.CATALOG.spokenOf[dialectId] || "";
};
Dox.chipEnglish = function (dialectId) {
  return Dox.CATALOG.displayNames[dialectId] || dialectId;
};
}
""",
        encoding="utf-8",
    )


def merge_packs() -> int:
    I18N_OUT.mkdir(parents=True, exist_ok=True)
    files = sorted(PACKS_SRC.glob("*.json"))
    if len(files) != 58:
        raise SystemExit(f"expected 58 packs, found {len(files)}")
    for src in files:
        pack = json.loads(src.read_text(encoding="utf-8"))
        dialect_id = pack.get("dialect_id")
        strings = pack.get("strings")
        if pack.get("status") != "approved" or not isinstance(strings, dict):
            raise SystemExit(f"unapproved or invalid pack {src.name}")
        delta = delta_for(dialect_id)
        for key, value in delta.items():
            if key in strings:
                raise SystemExit(f"{dialect_id} already has {key}; do not overwrite Android keys")
            strings[key] = value
        missing = [k for k in DELTA_EN if k not in strings]
        if missing:
            raise SystemExit(f"{dialect_id} missing delta after merge: {missing}")
        (I18N_OUT / src.name).write_text(
            json.dumps(pack, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return len(files)


def main() -> None:
    if not PACKS_SRC.is_dir():
        raise SystemExit(f"Android packs missing: {PACKS_SRC}")
    n = merge_packs()
    write_dialects_js()
    ids = list(DIALECT_DISPLAY_NAMES)
    if len(ids) != 293:
        raise SystemExit(f"expected 293 dialects, got {len(ids)}")
    if dialect_from_os_locale("es-MX") != standard_dialect_for("spanish"):
        raise SystemExit("es-MX must map to Spanish prestige chip")
    print(
        "generated",
        DIALECTS_JS.name,
        "packs",
        n,
        "dialects",
        len(ids),
        "PROMPT_VERSION",
        PROMPT_VERSION,
    )


if __name__ == "__main__":
    main()
