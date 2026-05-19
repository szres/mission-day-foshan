# MD 2026: Foshan — Mission Day Map

Interactive map for the 24-mission Foshan Mission Day banner, built on
**MapKit JS** and deployed on **Cloudflare Pages + Pages Functions**.

Live: <https://fsmd.szres.org>

Built by the Shenzhen RES (Resistance) agent community as a third-party
companion to Mission Day Foshan. Unofficial — not affiliated with or endorsed
by Niantic or the FSMD organisers.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Layout

```
FS-MD.js                       source data (IIFE-wrapped MDUMMJSON literal)
scripts/extract.mjs            FS-MD.js  →  public/missions.json
public/
  index.html                   shell
  app.js                       MapKit init, mission rendering
  style.css
  missions.json                generated, committed for static serving
  mapkit-token.js              your MapKit JS JWT (gitignored)
  mapkit-token.example.js      template
functions/
  api/portal-image.js          proxy for lh3.googleusercontent.com thumbnails
```

## MapKit JS token

Apple's current Maps console issues long-lived, pre-signed JWTs — no .p8 key,
no server-side signing required.

1. Go to <https://developer.apple.com/account/> → **Maps** → **Tokens**.
2. Click **+**, give it a description (e.g. `MD-FS`), set the **Domain** claim
   to the host you'll serve from (a wildcard like `*.szres.org` is allowed).
3. Copy the generated token string.
4. Locally:

   ```
   cp public/mapkit-token.example.js public/mapkit-token.js
   # paste your token into the MAPKIT_TOKEN string
   ```

The token's `origin` claim binds it to one host pattern, so it's safe to expose
in client-side JS — Apple rejects requests whose `Origin` header doesn't match.
When it expires, regenerate in the same console and update the file.

### Domain requirement

This token is bound to `*.szres.org`, so MapKit JS will reject the page when
served from `localhost`, `*.pages.dev`, or any other host. Two options for
local dev:

- **Custom domain on Pages.** Add e.g. `dev.szres.org` to your Pages project,
  point a CNAME at it, run `npm run deploy` and use that URL.
- **Local hosts override.** Put `127.0.0.1 fsmd.szres.org` in `/etc/hosts`,
  serve over HTTPS (MapKit requires it on non-localhost), and open
  `https://fsmd.szres.org:8788`. Easier to just deploy to a preview branch.

## Cloudflare configuration

The only Cloudflare-side state left is the image-proxy Function, which has no
secrets. Just:

```
npm install
npm run deploy            # builds + uploads public/ and functions/
```

The first deploy creates the Pages project. Subsequent deploys are incremental.

## Local development

```
npm run extract           # rebuild public/missions.json from FS-MD.js
npm run dev               # wrangler pages dev → http://localhost:8788
```

(See the domain caveat above — `localhost` works for the Functions but MapKit
will refuse to render until the page is served from `*.szres.org`.)

## How it renders

- **Overview** (`Show full banner`) — one muted polyline per mission and a
  small numbered square at each mission's starting portal. Click a square to
  zoom into that mission.
- **Mission view** — bright route polyline plus a numbered circular pin at
  every portal in order. First portal is green, last is red, intermediates
  cyan. A detail panel lists the portals with thumbnails (proxied through
  `/api/portal-image`).

## Decoding FS-MD.js

The source file is an IIFE wrapping a plain JSON literal:

```js
(() => {
  const MDUMMJSON = { missionSetName: "MD 2026: Foshan", ... };
})();
```

`scripts/extract.mjs` matches that literal with a regex and runs `JSON.parse`.
If you receive an updated `FS-MD.js`, re-run `npm run extract` and redeploy.

## Apple Maps deeplink

Each mission's detail panel includes an **Open in Apple Maps** button that
generates a `https://maps.apple.com/?daddr=...+to:...&dirflg=w` URL chaining
the portals as walking waypoints. On iOS/macOS this universal link opens the
native Maps app for turn-by-turn navigation; on other platforms it falls back
to the Apple Maps web view.

## Contributing

Issues and PRs welcome. The site is intentionally small and dependency-free
on the client (no build step, just static files in `public/`), so most
changes are straightforward.

If you adapt this codebase for a different Mission Day, the main things you'll
need to swap are:

- `FS-MD.js` — the source mission set
- `mission-names.json` — overrides for the displayed mission names
- `public/guides.json` — your Apple Maps Guide links (optional)
- `public/blogs.json` — your mission blog posts (optional)
- `public/banner-map.png`, `public/icon.svg`, `public/og-image.png` — branding
- `public/mapkit-token.js` — your own MapKit JS JWT (see above)

## License

[MIT](LICENSE) — free to use, modify, and redistribute with attribution.

Trademarks and game assets referenced (Ingress, Niantic, Mission Day, etc.)
remain the property of their respective owners. Mission and portal names
included in the source data come from the public Ingress mission-set export.
