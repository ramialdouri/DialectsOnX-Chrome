# Dialex Homepage

Public landing page and hosted **Pad** for Dialex (`dialex-app.com`).

Pad talks to the Dialex Cloud Run backend:

- `POST /translate` (`client_source: "pad"`)
- `POST /stt`

No API keys are embedded in this site.

## Local preview

```bash
# from repo root
python3 -m http.server 8080
# open http://localhost:8080
```

## Cloudflare Pages + `dialex-app.com`

1. **Add the domain to Cloudflare**
   - Dashboard → Add a site → `dialex-app.com`
   - Free plan
   - Set the Cloudflare nameservers at your registrar
   - Wait until status is **Active**

2. **Create a Pages project**
   - Workers & Pages → Create → Pages → Connect to Git
   - Select `ramialdouri/Dialex-Homepage`
   - Framework preset: **None**
   - Build command: *(empty)*
   - Build output directory: `/`
   - Production branch: `main`
   - Deploy

3. **Custom domains**
   - Pages project → Custom domains → `dialex-app.com`
   - Also add `www.dialex-app.com` (redirect www → apex recommended)
   - Let Cloudflare create/proxy the DNS records

4. **SSL**
   - SSL/TLS: **Full (strict)**
   - Always Use HTTPS: **On**

5. **Verify**
   - `https://dialex-app.com/`
   - `https://dialex-app.com/#pad`

Until the custom domain is live, use the Pages preview URL (`https://<project>.pages.dev/#pad`).

## Theme

Colors match Dialex Android (`InkBlack`, `InkSurface`, `TealAccent`, etc.).

Hero image in `assets/hero.png` was generated with Grok Imagine at **dev time** and is served statically (no runtime `/imagine` calls).

## DialectsOnX

The Chrome extension links here for the full Pad experience:
`https://dialex-app.com/#pad`

## Publishing to Dialex-Homepage

Intended destination repo: [ramialdouri/Dialex-Homepage](https://github.com/ramialdouri/Dialex-Homepage)
(Cloud Agent push to that repo returned 403). Copy the contents of this `dialex-homepage/` folder to the root of Dialex-Homepage, then connect Cloudflare Pages as above.
