# DialectsOnX — Cursor Instructions

## Source of truth
- Dialex Android branch **`early-debug-and-design`** (not July `main`)
- Catalog: 283 dialects / 56 spoken / 15 groups
- Live API: Dialex Cloud Run (`pad|lens|clip|share|ime`)

## Stack
- `extension/dialects.js` — catalog
- `extension/sheet.js` — modal dialect sheet
- `extension/content.js` — X feed (`client_source: clip`)
- `extension/ime.js` — field rewrite (`ime`), no soft keyboard
- Production backend: Cloud Run (repo `backend/` is legacy)

## Rules
- News/official → `arabic_msa`
- Dialect sheet: Favorites/Recents + Language|Dialect + search
- Theme for Dialex chrome: black / mist / silver / Manrope
- Prefer fewer translation requests; visibility-gated auto-translate on X
