# DialectsOnX

Chrome extension that translates X posts into Dialex dialects and adds a floating translation IME on every site. v0.3 talks to **Dialex** (same catalog, prompts, and Fix A Word store as Pad).

## Features

- **293 dialects** from Dialex (`PROMPT_VERSION` 4.2.32), picked with the Dialex catalog sheet
- **Always overlay** X post text (never replaces tweet `innerHTML`); emoji-safe extract via `<img alt>`
- **Auto-translate off** for new users; the main control starts on **Original** and translates that post on tap
- News / official (gray verified badge) still targets MSA when News → MSA is on
- **System Language**: 58 Dialex packs for extension chrome (independent of destination dialect)
- **IME** on all sites: dialect chip, Translate (`client_source=ime`), microphone STT
- **Fix A Word** on translated overlays posts into the shared Pad pool (`client_source=dialectsonx`)

## Install

1. Clone this repo
2. Open `chrome://extensions/`
3. Enable **Developer mode**
4. **Load unpacked** → select the `extension/` folder

Default API: `https://dialex-backend-f6b7-1086119311146.europe-west3.run.app`

For local Dialex, run uvicorn from [Dialex-Android](https://github.com/ramialdouri/Dialex-Android) `backend/` on `:8000` and set **Settings → Advanced → Backend URL** to `http://127.0.0.1:8000`.

## Project layout

```
extension/            MV3 client (load unpacked from here)
  manifest.json       0.3.0 — storage, offscreen STT, X feed + all-URL IME
  content.js          X feed overlay engine
  sheet.js            Dialex catalog sheet
  ime.js / faw.js     IME bar and Fix A Word
  i18n/               58 System Language packs
  test/demo.html      local tweet-DOM fixture (no x.com login)
scripts/gen_dialects.py   regenerate catalog + packs from Dialex-Android
```

Regenerate the catalog after an Android catalog bump:

```
python3 scripts/gen_dialects.py
python3 scripts/_test_chrome.py
```

## How it works

1. Content script finds on-screen posts and injects Original / Dialect Selector / logo
2. `POST /translate` with `client_source=dialectsonx`, `X-Device-Id`, and `GET /faw/fingerprint` before cache lookup
3. Translation is drawn in an overlay; X’s tweet node stays in the DOM (Show more still expands native text, then retranslates)
4. IME `POST /translate` uses `client_source=ime` and cannot submit FAW

## Tech

- Chrome Manifest V3 (vanilla JS, system UI fonts, no Dialex Latin)
- Dialex Cloud Run / local uvicorn (Gemini), not a separate DialectsOnX translator
