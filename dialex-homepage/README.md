# Dialex Homepage

Public Pad for Dialex (`dialex-app.com`).

Catalog and UI align with Dialex Android `main` (commit `112b2ec`):
283 dialects, black / Manrope theme, full-height dialect sheet
(Favorites / Recents + Language | Dialect). The sheet is only as wide as
the language and dialect names. English has no group header.

Pad talks to Dialex Cloud Run:

- `POST /translate` (`client_source: "pad"`)
- `POST /stt`

No API keys in the frontend. No onboarding flow.

## Local preview

```bash
python3 -m http.server 8080
# http://localhost:8080/
```

## Cloudflare Pages + `dialex-app.com`

1. Add `dialex-app.com` to Cloudflare; set nameservers at the registrar
2. Pages, Connect Git, `ramialdouri/Dialex-Homepage`
3. Framework: None. Build command empty. Output `/`. Branch `main`
4. Custom domains: `dialex-app.com` and `www`
5. SSL: Full (strict), Always HTTPS on

## Theme

Charcoal canvas (`#0A0A0B`), Manrope, mist / silver accents matching Android `colors.xml` on `main`.
