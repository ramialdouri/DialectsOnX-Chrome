# DialectsOnX Cursor Instructions

## Source of truth
- Dialex Android branch `main` (commit `112b2ec`)
- Catalog: 283 dialects / 56 spoken / 15 groups (stamp `112b2ec`)
- Live API: Dialex Cloud Run (`pad|lens|clip|share|ime`)

## Stack
- `extension/dialects.js`: catalog
- `extension/sheet.js`: full-viewport dialect sheet
- `extension/content.js`: X feed (`client_source: clip`)
- `extension/ime.js`: field rewrite (`ime`), no soft keyboard
- Production backend: Cloud Run (repo `backend/` is legacy)

## Rules
- News/official to `arabic_msa`
- Dialect sheet: Favorites/Recents + Language|Dialect + search
- English group is headerless; English row uses a Germanic badge
- Theme for Dialex chrome: black / mist / silver / Manrope
- Prefer fewer translation requests; visibility-gated auto-translate on X
- Do not use an em dash in UI copy or comments
