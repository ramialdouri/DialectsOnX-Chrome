# Dialex Homepage

Public landing page and hosted **Pad** for Dialex (`dialex-app.com`).

Catalog and UI align with Dialex Android branch **`early-debug-and-design`**:
283 dialects, black/Manrope theme, modal dialect sheet (Favorites / Recents + Language | Dialect).

Pad → Dialex Cloud Run:

- `POST /translate` (`client_source: "pad"`)
- `POST /stt`

No API keys in the frontend.

## Local preview

```bash
cd dialex-homepage
python3 -m http.server 8080
# http://localhost:8080/#pad
```

## Cloudflare Pages + `dialex-app.com`

1. Add `dialex-app.com` to Cloudflare; set nameservers at the registrar  
2. Pages → Connect Git → `ramialdouri/Dialex-Homepage`  
3. Framework: None · Build command empty · Output `/` · Branch `main`  
4. Custom domains: `dialex-app.com` + `www`  
5. SSL: Full (strict), Always HTTPS on  

Copy this folder’s contents to the root of [Dialex-Homepage](https://github.com/ramialdouri/Dialex-Homepage) before connecting Pages.

## Theme

Pure black canvas, Manrope, mist/silver accents — matching Android `colors.xml` / `Type.kt` on `early-debug-and-design`.
