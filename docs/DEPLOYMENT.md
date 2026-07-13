# Deployment

Leaky Sats is a Vite/React PWA deployed to Vercel. The production build output is `dist`, and SPA routes must fall back to `index.html`.

## Canonical URLs

Use the stable production URL for users, QR codes, documentation, and manual smoke tests:

```text
https://leaky-sats.vercel.app
```

Vercel also creates random deployment URLs for each build. Those URLs are useful for checking a specific preview or production build, but they should not be shared as permanent user-facing links.

## Vercel Project Settings

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Production branch: `master`
- Stable domain: `leaky-sats.vercel.app`

`vercel.json` contains the build command, output directory, SPA rewrite fallback, security headers, and cache rules for the service worker and manifest.

## Required Post-Deploy Checks

After a merge to `master`, confirm:

1. GitHub CI is green for the merged commit.
2. Vercel created a production deployment for the latest `master` commit.
3. Vercel deployment state is `READY`.
4. The stable URL opens without a blank screen.
5. `/manifest.webmanifest`, `/sw.js`, and `/icons/icon-192.png` return `200`.
6. `/api/upbit` returns JSON like `{ "btcKrw": 95000000 }`.
7. Refreshing an internal route such as `/settings` does not return `404`.

## Mobile And PWA Checks

Manual mobile checks belong in the release checklist, not in deterministic CI.

- Open the stable URL on Android Chrome and iOS Safari.
- Install the PWA from the browser prompt or "Add to Home Screen".
- Open the installed app in standalone mode.
- Confirm the bottom navigation, transaction input, settings, backup/restore, and price card fit without overlap.
- Turn on airplane mode and reopen the installed app to confirm the shell still loads.
- Confirm localStorage data remains visible offline.

## QR Codes

Only encode the stable production URL:

```text
https://leaky-sats.vercel.app
```

Do not encode random Vercel deployment URLs. If the production domain changes later, update this document, `package.json`, `src/constants/appMeta.ts`, and any user-facing QR material together.

## Service Worker Updates

The service worker is stamped during `npm run build` by `scripts/build-sw.mjs`. Production responses for `/sw.js`, `/manifest.webmanifest`, `/`, and `/index.html` are configured to revalidate so users can pick up a new app shell after deployment.

If an old version still appears after a release, fully close and reopen the browser/PWA, then refresh.

## Backup/Restore Warning

Leaky Sats is localStorage-first and effectively localStorage-only for user ledger data unless the user exports a backup. Browser data deletion, device changes, browser changes, or profile resets can remove local data unless the user has exported a backup.

Backup files can contain sensitive financial history and watch-only wallet descriptors. Store them safely and do not share them publicly.
