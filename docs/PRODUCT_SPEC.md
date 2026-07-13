# Product Spec

## Definition

Leaky Sats is a mobile-first PWA ledger for Korean Bitcoiners. It helps users record KRW cashflow, understand spending in BTC/sats terms, and manage monthly settlement decisions without turning the app into an exchange, broker, or custodial wallet.

## User Problem

- KRW-only ledgers hide the BTC/sats cost of daily spending.
- Bitcoin price context is scattered across exchanges, FX sources, and block explorers.
- Manual held-BTC tracking can drift unless confirmed sales and wallet balances are handled carefully.
- Users need a simple local tool that works on mobile without creating another account.

## Core Value

- Fast transaction entry.
- KRW cashflow plus BTC/sats perspective.
- Practical monthly settlement card.
- Live price status with conservative stale/fallback handling.
- Local-first data ownership with explicit backup/export.
- Optional watch-only wallet sync without private-key custody.

## Screens

### Home

- Wallet/header summary.
- Held BTC and current value.
- Monthly settlement period.
- Income, expense, and net cashflow.
- Recurring pending items.
- Confirmed monthly/yearly BTC sale summaries.
- Bitcoin price card.
- Recent transactions.

### Input

- Income/expense transaction entry.
- Amount keypad on mobile.
- Category, title, memo, and date.
- Recurring item controls.

### Transactions

- Transaction list.
- Edit/delete row actions.
- Undo after delete.
- Date-only labels.

### Stats

- Monthly totals.
- Category breakdown.
- Calendar/month view.
- Selected-day transaction detail.

### Settings

- Help page entry.
- Display currency and BTC/sats unit preference.
- Price status and manual refresh.
- Wallet name.
- Manual held-BTC entry and watch-only wallet sync settings.
- Settlement day.
- Recurring rules.
- Categories.
- Backup/restore.
- Local app lock.
- App ownership/deployment metadata.

## Data Model

The app is localStorage-first. Stable keys are documented in [DATA_MODEL.md](DATA_MODEL.md). Changes to durable storage must update backup/restore behavior and related verification scripts in the same change.

## Price Model

- BTC/KRW: Vercel `/api/upbit` proxy first, direct Upbit fallback, then BTC/USD x USD/KRW fallback.
- BTC/USD: public market data fallback chain.
- USD/KRW: FX fallback chain.
- Kimchi premium is shown only when sources are fresh and valid.
- Fallback-derived BTC/KRW must not produce fake kimchi premium.

## Wallet Sync Model

Wallet sync is watch-only:

- Users may add xpubs or addresses.
- The app derives or scans public addresses only.
- The app queries mempool/Esplora APIs.
- The app never handles seed phrases or private keys.

## Deployment

Production is Vercel:

```text
https://leaky-sats.vercel.app
```

User-facing docs and QR codes must use the stable Vercel URL only.

## Non-Goals

- Server account system.
- Custodial wallet.
- Seed/private-key storage.
- Exchange trading.
- Bank account login.
- Cloud backup or cross-device sync without a separate security design.
- App Store or Play Store distribution.
