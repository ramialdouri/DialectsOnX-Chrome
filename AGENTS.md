# AGENTS.md

## Cursor Cloud specific instructions

DialectsOnX has two components: a FastAPI backend (`backend/`) and a plain-JS
Chrome Manifest V3 extension (`extension/`). There is no database, no frontend
build step, and no automated tests or linters configured in this repo.

### Environment
- Python dependencies are installed into a repo-local virtualenv at `venv/`
  (gitignored). The startup update script keeps it in sync with
  `backend/requirements.txt`. Use `venv/bin/python` / `venv/bin/uvicorn` (or
  activate with `source venv/bin/activate`) rather than the system Python.

### Backend (`backend/`) — required service
- Run in dev mode from the `backend/` directory:
  `../venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8000`
- Endpoint: `POST /translate` with body `{"text": "...", "target": "<dialect>", "source": "auto"}` → `{"translation": "..."}`.
- IMPORTANT (non-obvious): the xAI `Client` is constructed at module import time
  in `main.py`, so the backend will **not start at all** unless an API key env
  var is set. The code reads `GROK_API_KEY`; if unset, the xAI SDK then looks for
  `XAI_API_KEY` and raises `ValueError` on import. Set `GROK_API_KEY` (add it as
  a Cursor secret) before launching uvicorn. `load_dotenv(override=True)` also
  reads a `backend/.env` file if present (`.env` is gitignored).
- Graceful degradation: if the key is missing/invalid, the `/translate` handler
  catches the xAI error and returns the **original untranslated text** with HTTP
  200 (`main.py` try/except). So a 200 response that echoes the input means the
  key is bad — real translations require a valid key.
- The model name requested in `main.py` is `grok-4.3`; verify it is valid for the
  provided key if translations fail.

### Extension (`extension/`) — client
- No build/install step. Load unpacked via `chrome://extensions` → enable
  Developer mode → "Load unpacked" → select the `extension/` folder.
- Configure the backend it talks to via the popup's "Backend URL" field (default
  `https://dialectsonx.onrender.com`; set to `http://localhost:8000` for local
  backend). Settings persist in `chrome.storage.sync`.
- The content script only runs on `x.com` / `twitter.com`, so full end-to-end
  translation testing on-site requires an X login plus a valid `GROK_API_KEY`.
