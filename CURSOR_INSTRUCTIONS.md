# DialX Project Instructions for Cursor

## Project Overview
- Chrome Extension that automatically translates X (Twitter) posts to the user's preferred Arabic dialect.
- Uses Grok 4.3 via xAI SDK for translation.
- Clean, subtle UI.

## Current Stack
- Frontend: Chrome Extension (Manifest V3)
- Backend: FastAPI + xAI SDK
- Main file for UI: `extension/content.js`

## Key Requirements

### Dialect List (Exact Order)
MSA, Emirati, Saudi-Najdi, Saudi-Hijazi, Kuwaiti, Qatari, Syrian, Lebanese, Jordanian, Palestinian, Iraqi, Egyptian, Sudanese, Moroccan, Algerian, Tunisian

### Important Behavior Rules
- **News / Official posts + Gray badge accounts + Yellow badge accounts**: Must show **MSA** (`🌐 MSA`) and **never auto-translate** to user's dialect.
  - This includes posts containing news/official keywords and posts from accounts with gray verification badges.
- Normal posts: Auto-translate to user's preferred dialect.
- Main button (country/flag) must toggle properly between Translated and Original.
- Only **one** "Dialect Selector" button per post.
- Gray buttons with black text.
- Dialect selector panel must close when clicking outside.
- Use **sliding toggle buttons** (switches) for selecting the "Default" dialect (only one can be active at a time).

### Coding Rules
- Prioritize clean, functional, and stable code.
- Only translate posts that are currently visible on screen (use Intersection Observer).
- Reduce unnecessary translation requests as much as possible.