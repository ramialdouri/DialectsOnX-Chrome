# DialX — Arabic Dialect Translator for X

**DialX** is a Chrome Extension that automatically translates X posts into your preferred Arabic dialect. Makes Arabic X much more natural and enjoyable to read. Helps Arabic-speaking users discover and engage with English and international content on X

## Features

- **16 Arabic dialects supported:**
  MSA, Emirati, Saudi-Najdi, Saudi-Hijazi, Kuwaiti, Qatari, Syrian, Lebanese, Jordanian, Palestinian, Iraqi, Egyptian, Sudanese, Moroccan, Algerian, Tunisian
- **Smart translation rules:**
  - Normal posts → translated to your chosen dialect
  - Detected news & official accounts (gray badges) → MSA by default
- **Per-post control:**
  - Click the dialect button to toggle between original and translated text
  - "Dialect Selector" panel with radio buttons for default dialect selection
- Clean UI that blends with X's design
- Backend powered by **Grok 4.3** via the xAI API

## Installation (Easiest Method)

1. Download `DialX-v0.1.0.zip` from the [Releases page] 
2. Extract the zip file
3. Go to `chrome://extensions/`
4. Enable **Developer mode** (top right)
5. Click **"Load unpacked"** and select the extracted `extension` folder

**No backend setup required** — it connects automatically to the hosted backend.

## Backend

The backend is hosted 24/7 on Render.com.

**Base URL:** `https://dialectsonx.onrender.com`

**Main Endpoint:** `POST /translate`  
(This receives the text and target dialect, then returns the translation)

## Project Structure

```bash
dialx/
├── extension/          # Chrome Extension files
│   ├── manifest.json
│   ├── content.js
│   ├── popup.html
│   └── popup.js
│   ├── dialx_logo.png
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── backend/            # FastAPI backend
│   ├── main.py
│   └── requirements.txt
```

## How It Works

1. Uses a `MutationObserver` to detect on-screen posts
2. Sends the post text to the hosted FastAPI backend
3. The backend uses Grok 4.3 to translate it into the chosen dialect
4. Results are injected directly into the post

## Future Plans

- Mobile support
- In-sync video subtitles (Grok-generated per user request)
- Translation quality optimization
- Performance/speed optimization
- News detection optimization
- "Rate This Translation" button/feature
- Minimazable "Dialect Selector" button
- Expansion to support all languages and dialects worldwide

## Tech Stack

- **Frontend:** Chrome Manifest V3 + JavaScript
- **Backend:** FastAPI + xAI Grok 4.3


## Note
This is an **early prototype (v0.1.0)**. Some bugs may exist. Feedback is very welcome!
