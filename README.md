# DialectsOnX — Dialect Translator for X

**DialectsOnX** is a Chrome Extension that translates X posts into your preferred dialect, and can swap text in website text boxes (IME-style). Powered by the shared **Dialex** backend.

## Features (v0.2)

- **Multi-language Dialex catalog:** Arabic, Spanish, English, Portuguese, French dialects
- **Dialex-style dialect sheet:** language dropdown + dialect chips (replaces the v0.1 radio panel)
- **Smart translation on X:**
  - Normal posts → preferred dialect
  - News & official (gray badge) → MSA by default
- **IME Pad:** focus any site text box → Translate replaces the text in place (`client_source: ime`)
- **Full Pad + STT:** hosted on [Dialex Homepage](https://dialex-app.com/#pad) (link in popup & sheet)
- Backend: Dialex Cloud Run + Grok

## Installation

1. Download the latest release zip (or use the `extension/` folder)
2. Go to `chrome://extensions/`
3. Enable **Developer mode**
4. **Load unpacked** → select the `extension` folder

## Backend

Default base URL:

`https://dialex-backend-f6b7-1086119311146.europe-west3.run.app`

| Endpoint | Used by |
|--|--|
| `POST /translate` | X feed (`clip`), IME (`ime`) |
| `GET /health` | Popup health check |
| `POST /stt` | Dialex Homepage Pad |

Override the URL in the extension popup if needed.

## Project structure

```bash
dialectsonx/
├── extension/          # Chrome Extension (MV3)
│   ├── manifest.json
│   ├── dialects.js     # Shared Dialex catalog
│   ├── content.js      # X feed UI + translate
│   ├── ime.js          # Website textbox IME
│   ├── popup.html
│   └── popup.js
└── backend/            # Legacy local FastAPI (optional; production uses Dialex Cloud Run)
```

## Dialex Homepage Pad

Full Pad (source/output panes + mic STT) lives on the Dialex site:

`https://dialex-app.com/#pad`

Until DNS is live, use the Cloudflare Pages preview URL after deploying [Dialex-Homepage](https://github.com/ramialdouri/Dialex-Homepage) (see also the `dialex-homepage/` branch/PR if present).

## Tech stack

- Chrome Manifest V3
- Dialex Cloud Run API (Grok 4.3 + STT)

## Note

Early release (**v0.2.0**). Feedback welcome.
