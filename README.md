# DialectsOnX: Dialect Translator for X

Chrome extension that translates X posts into Dialex dialects and can rewrite text in website text boxes (IME-style). Uses the shared Dialex Cloud Run backend.

Catalog / picker aligned with Dialex Android `early-debug-and-design` @ `a385a0c`: 15 groups, 56 spoken languages, 283 dialects.

## Features (v0.2)

- Full Dialex dialect catalog with Favorites / Recents + Language | Dialect sheet
- English has no group header (Germanic badge), matching Android
- Sheet fills the viewport
- X feed translate (`client_source: clip`); news/official to MSA
- IME: focus any site text box, Translate replaces text in place (`ime`). No soft keyboard
- Full Pad + STT on [Dialex Homepage](https://dialex-app.com/#pad)
- Black / mist / silver Dialex sheet chrome (Manrope)

## Installation

1. Load unpacked `extension/` from `chrome://extensions/` (Developer mode)

## Backend

Default: `https://dialex-backend-f6b7-1086119311146.europe-west3.run.app`

| Endpoint | Used by |
|--|--|
| `POST /translate` | Feed (`clip`), IME (`ime`) |
| `GET /health` | Popup |
| `POST /stt` | Dialex Homepage Pad only |

The in-repo [`backend/`](backend/) folder is legacy v0.1 (Arabic-only Render prototype) and is not used by v0.2. Do not point the extension at it.

## Structure

```bash
extension/
  dialects.js   # generated from early-debug-and-design @ a385a0c
  sheet.js      # Dialex dialect sheet
  content.js    # X feed
  ime.js        # website field rewrite
  popup.html
backend/        # DEPRECATED: local legacy only
```

## Note

v0.2.0 early release. Source of truth for catalog/UX: Dialex-Android `early-debug-and-design`.
