# Release Checklist

Use this checklist after a PR is merged into `master`.

## 1. Confirm CI

1. Open the merged PR or the latest `master` commit on GitHub.
2. Confirm the `CI / Build and targeted verifies` check is green.
3. If CI failed, do not share the release URL yet. Fix the failing check first.

## 2. Confirm Vercel Production

1. Open the Vercel project deployments.
2. Find the deployment for the latest `master` commit.
3. Confirm the deployment target is `production`.
4. Confirm the deployment state is `READY`.
5. The random deployment URL is only for confirming that exact build.

## 3. Open the Stable Production URL

1. Open the user-facing stable URL:

   ```text
   https://ledger-for-bitcoiners.vercel.app
   ```

2. Confirm the page loads without a blank screen.
3. Confirm the latest visible change from the release is present.
4. Use this stable URL for user sharing and QR codes.

## 4. Mobile Smoke Test

1. Open the stable URL on Android Chrome or iOS Safari.
2. Confirm the bottom navigation is reachable.
3. Open Settings -> Help / Usage and confirm the in-app help page loads.
4. Confirm text and buttons do not overlap on the main screens.
5. If the old version still appears, fully close and reopen the browser/PWA, then refresh.

## 5. Transactions

1. Add a small test transaction.
2. Edit the transaction title, amount, date, and category.
3. Delete the transaction.
4. Use undo if available and confirm the row returns.
5. Delete the test transaction again if needed.

## 6. Recurring Items

1. Create or edit a transaction with monthly recurring checked.
2. Confirm the recurring checkbox remains checked when editing that transaction again.
3. Open the recurring pending card for a relevant month.
4. Confirm a recurring item can be added or skipped without duplicate rows.

## 7. Backup Download

1. Open Settings.
2. Download a plain backup.
3. Confirm the browser downloads a `.json` file.
4. Confirm Settings shows the latest backup time.
5. Turn on encrypted backup and download again with a test password.
6. Confirm the encrypted backup JSON contains `enc: "aes-gcm"` and does not expose plain transaction data.

## 8. Encrypted Backup Restore

1. Choose an encrypted backup file in Settings.
2. Confirm the app asks for the backup password.
3. Try a wrong password and confirm an error is shown.
4. Enter the correct password and confirm the restore preview appears.
5. Confirm restore only after checking the preview.
6. After restore, use the refresh button or reload the page so in-memory state matches localStorage.

## 9. Price Delay Display

1. Check the Bitcoin Price card.
2. If all price sources are fresh, confirm the kimchi premium is shown.
3. If one source is delayed, confirm the card shows a pending/delayed state instead of an unrealistic number.
4. Confirm delayed source copy names the affected source, such as `BTC/KRW`, `BTC/USD`, or `USD/KRW`.
5. Confirm Settings shows the last normal update time for delayed sources.

## 10. PWA and Offline Shell

1. Open the stable URL in a mobile browser.
2. Install the app with "Add to Home Screen" or the browser install prompt.
3. Open the installed PWA.
4. Turn on airplane mode or disconnect the network.
5. Reopen or refresh the PWA.
6. Confirm the app shell still loads.
7. Confirm localStorage data is still visible.

## 11. Final Share Check

1. Share only the stable production URL:

   ```text
   https://ledger-for-bitcoiners.vercel.app
   ```

2. Do not share random Vercel deployment URLs.
3. If making a QR code, encode the stable production URL only.
