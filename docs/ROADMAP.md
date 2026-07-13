# Roadmap

This roadmap records the current product direction and shipped milestones for Leaky Sats.

## Product Direction

Leaky Sats is a mobile-first PWA ledger for Korean Bitcoiners. It stays localStorage-first, avoids custodial wallet behavior, and frames BTC information as practical personal ledger context rather than investment advice.

## Shipped Foundations

- Vite/React/TypeScript PWA shell.
- Mobile bottom navigation.
- Transaction add/edit/delete with undo.
- Date-only transaction labels.
- Category management and category-unified statistics.
- Monthly settlement period support.
- BTC/sats display unit preference.
- Live BTC/KRW, BTC/USD, USD/KRW, block-height, and kimchi-premium display.
- Upbit same-origin Vercel proxy with fallback price paths.
- PWA service worker refresh behavior.
- Plain and encrypted backup/restore.
- Local app lock.
- First-run onboarding and settings-linked help page.

## Current Wallet Sync Direction

Leaky Sats supports two held-BTC modes:

- Manual mode: the user enters held BTC directly.
- Wallet-sync mode: the app derives watch-only addresses from xpub/address input and reads balances from mempool/Esplora APIs.

Wallet sync must remain watch-only. The app must never ask for, store, import, or derive private keys or seed phrases.

## Deployment Direction

Production is Vercel-only for user-facing releases.

- Stable URL: `https://leaky-sats.vercel.app`
- Production branch: `master`
- Build output: `dist`
- User-facing QR/share links must use the stable Vercel URL.

Old non-Vercel deployment instructions in README or release docs should be treated as stale.

## Verification Direction

Deterministic checks stay in scripts and CI:

- `npm run build`
- `npm test`
- `npm audit --omit=dev`
- `npm run verify:release`
- Full `verify:*` sweep for broad cleanup/release work

Manual browser, mobile, PWA install, production deployment, and QR checks stay in `docs/RELEASE_CHECKLIST.md`.

## Known Follow-Up Areas

- Continue simplifying the home screen so it feels more like an installed app and less like a web dashboard.
- Keep price-delay copy concise on the home screen and move technical source detail to Settings where possible.
- Keep wallet sync diagnostics useful without exposing implementation noise in the main UI.
- Review Dependabot PRs individually; do not merge major upgrades without passing build and targeted verify scripts.
- Keep docs synchronized when storage keys, backup payloads, deployment URLs, or user-visible behavior changes.

## Explicit Non-Goals

- No custodial wallet.
- No seed/private-key storage.
- No exchange trading or exchange API-key integration.
- No bank-login scraping.
- No cloud account system until a separate design and security model exists.
- No random deployment URLs in user-facing docs or QR codes.
