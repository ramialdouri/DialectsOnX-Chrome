# DialectsOnX Project Instructions for Cursor

## Project Overview
- Chrome Extension that translates X (Twitter) posts to the user's preferred dialect (Dialex catalog).
- IME mode swaps text inside focused website text boxes.
- Full Pad + STT is on Dialex Homepage (`https://dialex-app.com/#pad`), not in the extension.
- Uses Dialex Cloud Run + Grok.

## Current Stack
- Frontend: Chrome Extension (Manifest V3)
- Shared catalog: `extension/dialects.js`
- X UI: `extension/content.js`
- IME: `extension/ime.js`
- Backend (production): Dialex Cloud Run

## Dialect catalog
Use live Dialex IDs (`arabic_egyptian`, `spanish_mexican`, …). Migrate legacy short keys via `DialexCatalog.normalizeDialectId`.

News / official posts (gray badges, news heuristics) → force `arabic_msa`.

## Dialect sheet UX
Replace the old radio grid with Dialex Android pattern:
- Language dropdown
- Dialect chips for selected language
- Auto-translate toggle
- Translate post action
- Link to Dialex Pad

## API
```json
{
  "text": "...",
  "target_dialect": "arabic_egyptian",
  "source_language": "auto",
  "client_source": "clip"
}
```
IME uses `client_source: "ime"`. Homepage Pad uses `pad`.

## Coding Rules
- Prefer clean, stable code.
- Only auto-translate posts currently visible (Intersection Observer).
- Reduce unnecessary translation requests.
- Keep one dialect panel instance; close on outside click.
