# Security And Privacy

## LocalStorage-First Privacy Model

Leaky Sats has no server account database. User transaction data lives in the user's browser localStorage unless the user exports a backup file.

Opening the same production URL from another device does not reveal the original device's data. Opening the same browser profile on the same device can reveal the local data, so users should enable local app lock when needed.

## Official Deployment

The user-facing production URL is:

```text
https://leaky-sats.vercel.app
```

Do not share random Vercel deployment URLs as permanent links.

## Local App Lock

The app lock is a local 4-6 digit PIN screen. It is not server authentication.

- PINs are not stored in plaintext.
- The app stores a salt and PBKDF2 hash using Web Crypto.
- App lock is device/browser-local.
- It helps reduce casual same-device viewing.
- It does not protect against a compromised device, malicious extensions, DevTools/localStorage inspection, or leaked backup files.

If the PIN is forgotten, there is no server recovery. The practical recovery path is browser localStorage reset, which removes local data unless the user has a backup.

## Backup Policy

Plain and encrypted backups are handled by `src/lib/backup.ts`.

Backups can include:

- Transactions
- Categories
- Held BTC
- Display preferences
- Refresh interval
- BTC sale records
- Settlement day
- Recurring rules and materialized recurring state
- Watch-only wallet configuration when present

Backups do not include:

- Pending undo state
- App lock PIN settings (`myledger.appLock.v1`)
- Install prompt dismissal state
- Pre-restore safety backup (`myledger.preRestoreBackup.v1`)

Encrypted backups use AES-GCM with PBKDF2. The backup password is separate from the app PIN and is not saved by the app.

## Never Store Secrets

Leaky Sats is not a Bitcoin wallet. The app must never ask for or store:

- Seed phrases
- Private keys
- Exchange API keys
- Bank login credentials
- Personal identity documents

Watch-only wallet sync may store xpubs or addresses. These cannot spend funds, but they can reveal wallet activity and should still be treated as private.

## Network And API Notes

- Price and wallet data is fetched from public APIs or user-configured mempool/Esplora APIs.
- Upbit BTC/KRW is accessed through the same-origin Vercel `/api/upbit` proxy to avoid browser CORS failures.
- A user-configured mempool endpoint must be HTTPS in production PWA use, except for local development on `localhost`.

## Security Headers

Production headers are configured in `vercel.json`, including CSP, frame blocking, content type sniffing protection, referrer policy, and permissions policy.
