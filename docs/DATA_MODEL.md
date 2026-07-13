# Data Model

This app is localStorage-first. Most user data lives only in the browser unless
the user downloads a backup file. Treat every persisted key below as a stable
data contract.

Changing or renaming a `myledger.*.v1` key can break existing user data. When a
new persisted field is added, update backup/restore validation and the related
`verify:*` script in the same change.

## localStorage Keys

| Key | Owner | Purpose |
| --- | --- | --- |
| `myledger.txns.v1` | `src/state/LedgerContext.tsx` | Transaction list and `nextTxnId`. |
| `myledger.categories.v1` | `src/state/LedgerContext.tsx` | User-visible category definitions. |
| `myledger.pendingUndo.v1` | `src/state/LedgerContext.tsx` | Short-lived delete undo state. Not included in backups. |
| `myledger.heldBtc.v1` | `src/lib/heldBtc.ts` | Current held BTC balance. |
| `myledger.displayUnit.v1` | `src/lib/format.ts` | BTC display unit preference: `BTC` or `sats`. |
| `myledger.currency.v1` | `src/lib/preferences.ts` | Primary display currency preference. |
| `myledger.refreshInterval.v1` | `src/lib/preferences.ts` | Live price refresh interval. |
| `myledger.btcSellRecords.v1` | `src/lib/btcSellRecords.ts` | Confirmed BTC sale records. |
| `myledger.settlementDay.v1` | `src/lib/settlement.ts` | Monthly settlement start day, 1 through 31. |
| `myledger.recurringRules.v1` | `src/lib/recurringRules.ts` | Monthly recurring item rules. |
| `myledger.recurringMaterialized.v1` | `src/lib/recurringRules.ts` | Rule/month pairs already handled. |
| `myledger.preRestoreBackup.v1` | `src/lib/backup.ts` | Safety backup created immediately before restore. Not included in backups. |
| `myledger.lastBackupAt.v1` | `src/lib/backup.ts` | UX-only timestamp of the last successful backup download. Not included in backups. |

Legacy key: `myledger.monthlyCash.v1` belonged to the removed monthly-cash
settlement flow. Current backup/restore code ignores it and does not write it
back during restore.

## Transactions

Stored under `myledger.txns.v1`:

```ts
{
  txns: Txn[];
  nextTxnId: number;
}
```

`Txn` shape:

```ts
interface Txn {
  id: number;
  title: string;
  cat: string;
  catLabel: string;
  time: string;
  date: string;
  amount: number;
  btcAt: number;
  memo?: string;
  recurringRuleId?: string;
}
```

`amount` is signed KRW. Income is positive, expense is negative. `btcAt` is the
KRW/BTC rate captured when the transaction is created and should not be
recalculated later. `recurringRuleId` links a transaction back to a recurring
rule when it came from, or was attached to, a monthly rule. Older transactions
may not have this field.

## Categories

Stored under `myledger.categories.v1` as an array:

```ts
interface CategoryDef {
  id: string;
  label: string;
  group: "expense" | "income" | "invest";
  flow: "expense" | "income";
  icon: string;
  fg: string;
  protected?: boolean;
}
```

`group` controls grouping in the UI. `flow` controls whether a transaction
amount becomes income or expense. Protected built-in category ids should not be
deleted.

## Recurring Rules

Stored under `myledger.recurringRules.v1`:

```ts
interface RecurringRule {
  id: string;
  title: string;
  cat: string;
  isIncome: boolean;
  dayOfMonth: number;
  lastAmount?: number;
  createdAt: string;
}
```

The transaction edit screen first matches a rule by `Txn.recurringRuleId`. If
that field is missing, it falls back to the older title/category/flow/day match.

## Recurring Materialized State

Stored under `myledger.recurringMaterialized.v1` as strings:

```ts
["recurring-rule-id:YYYY-MM"]
```

This prevents the same recurring rule from creating duplicate transactions in a
settlement month. Deleting a rule should not delete historical transactions.

## BTC Sale Records

Stored under `myledger.btcSellRecords.v1`:

```ts
interface BtcSellRecord {
  id: string;
  month: string;
  date: string;
  btcSold: number;
  satsSold: number;
  btcKrwAtSell: number;
  krwCovered: number;
  deficitKrwAtConfirm: number;
  deductedFromHeldBtc: boolean;
  deductedBtcAmount?: number;
  note?: string;
  createdAt: string;
}
```

These are confirmed historical records. They should not be recalculated from
the current BTC price.

## Backup JSON

Plain backups are JSON wrappers:

```ts
{
  app: "my-ledger";
  version: 1;
  createdAt: string;
  data: {
    "myledger.txns.v1": unknown;
    "myledger.categories.v1": unknown;
    "...optional keys": unknown;
  };
}
```

The backup `app` value remains `"my-ledger"` for backward compatibility with
existing exported backups. User-facing app naming should use Leaky Sats.

Restore must pass through `prepareBackupRestore()` before writing to
localStorage. That step sanitizes known arrays, preserves supported optional
keys, rejects invalid required blocks, and creates a pre-restore safety backup.

## Encrypted Backup JSON

Encrypted backups wrap the plain backup payload:

```ts
{
  app: "my-ledger";
  enc: "aes-gcm";
  encVersion: 1;
  kdf: {
    name: "PBKDF2";
    hash: "SHA-256";
    iterations: 200000;
    salt: string;
  };
  iv: string;
  ciphertext: string;
}
```

The ciphertext is the JSON string of the plain `BackupPayload`. The backup
password is separate from the app PIN and must not be saved.

## Price State

Live prices are fetched independently:

| Field | Source |
| --- | --- |
| `btcKRW` | Upbit KRW-BTC |
| `btcUSD` | Binance primary, Coinbase fallback |
| `usdKRW` | Frankfurter primary, Coinbase fallback |
| `blockHeight` | mempool.space primary, blockchain.info fallback |

`LedgerContext` keeps successful values and only updates fields that succeeded.
It also tracks per-source success timestamps in `priceFreshness`. Because a
partial fetch can mix old and new prices, kimchi premium should only be shown
when all three price sources are fresh from the same successful fetch and are
not fallback/outlier values.
