# Leaky Sats

Leaky Sats is a mobile-first Vite/React PWA for Korean Bitcoiners. It helps users record KRW income and expenses, see the same spending in BTC/sats terms, track a practical monthly settlement view, and optionally sync watch-only wallet balances.

Official production URL:

```text
https://leaky-sats.vercel.app
```

## What It Does

- Records income and expense transactions in localStorage.
- Shows monthly income, expense, net cashflow, and settlement status.
- Converts KRW amounts to BTC or sats using live price data.
- Shows BTC/KRW, BTC/USD, USD/KRW, and kimchi premium when sources are fresh.
- Supports confirmed BTC sale records for monthly settlement.
- Supports recurring monthly items.
- Supports manual held-BTC entry or watch-only wallet sync via xpub/address + mempool/Esplora APIs.
- Provides plain and encrypted local backup/restore.
- Supports PWA install, offline shell loading, and local app lock.

## Current Scope

This is a localStorage-first, localStorage-only PWA for user ledger data. It does not provide server accounts, cloud sync, custodial wallet features, exchange trading, seed storage, bank login, or exchange API-key integration.

Leaky Sats is not a wallet and does not store private keys or seed phrases. Watch-only wallet sync stores xpubs or addresses only when the user explicitly adds them.

## Tech Stack

- Vite
- React
- TypeScript
- React Router
- localStorage
- Vercel Functions for same-origin API proxies
- PWA service worker

## Local Development

```bash
npm install
npm run dev
npm run build
```

## Verification

Before publishing or merging meaningful changes, run:

```bash
npm run build
npm test
npm audit --omit=dev
npm run verify:release
```

For broad cleanup or release work, run the full registered `verify:*` sweep.

## Deployment

Production is deployed on Vercel.

- Build command: `npm run build`
- Output directory: `dist`
- Stable production URL: `https://leaky-sats.vercel.app`
- Do not share random Vercel deployment URLs with users.

Detailed release and mobile/PWA checks live in:

- [Deployment guide](docs/DEPLOYMENT.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)

## Data And Security

User data lives in each browser's localStorage unless the user exports a backup. Backups can contain transaction history, categories, held BTC, BTC sale records, recurring rules, and watch-only wallet descriptors. Treat backup files as sensitive.

Leaky Sats never stores:

- Bitcoin seed phrases
- 비트코인 시드 문구
- Private keys
- 개인키
- Exchange API keys
- Bank login credentials

More details:

- [Data model](docs/DATA_MODEL.md)
- [Security and privacy](docs/SECURITY.md)
- [Wallet sync](docs/WALLET_SYNC.md)

## Project Docs

- [Product spec](docs/PRODUCT_SPEC.md)
- [Roadmap](docs/ROADMAP.md)
- [Technical decisions](docs/TECH_DECISIONS.md)
- [Mempool HTTPS/CORS guide](docs/MEMPOOL_HTTPS_CORS.md)

## Ownership

Leaky Sats is created and maintained by TIROBITCOIN.

Original repository:

```text
https://github.com/TIROBITCOIN/leaky-sats
```

Copyright 2026 TIROBITCOIN. All rights reserved.

This repository is public for visibility, but no license is granted for copying, redistribution, sublicensing, or commercial use unless explicitly permitted by the copyright holder.
