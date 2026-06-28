import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const root = process.cwd();
const backupPath = join(root, "src", "lib", "backup.ts");
const cardPath = join(root, "src", "components", "settings", "BackupRestoreCard.tsx");
const deploymentPath = join(root, "docs", "DEPLOYMENT.md");
const readmePath = join(root, "README.md");

assert.equal(existsSync(backupPath), true, "src/lib/backup.ts exists");
const backup = readFileSync(backupPath, "utf8");
assert.match(backup, /createBackupPayload/, "createBackupPayload exists");
assert.match(backup, /downloadBackup/, "downloadBackup exists");
assert.match(backup, /parseBackupFile/, "parseBackupFile exists");
assert.match(backup, /validateBackupPayload/, "validateBackupPayload exists");
assert.match(backup, /prepareBackupRestore/, "restore payload is sanitized before writing");
assert.match(backup, /restoreBackupPayload/, "restoreBackupPayload exists");
assert.match(backup, /export interface EncryptedBackupFile/, "encrypted backup file type exists");
assert.match(backup, /export async function encryptBackupPayload/, "encryptBackupPayload exists");
assert.match(backup, /export async function decryptBackupFile/, "decryptBackupFile exists");
assert.match(backup, /export function isEncryptedBackupFile/, "isEncryptedBackupFile exists");
assert.match(backup, /export async function downloadEncryptedBackup/, "downloadEncryptedBackup exists");
assert.match(backup, /export async function readBackupFile/, "readBackupFile exists");
assert.match(backup, /PBKDF2/, "PBKDF2 key derivation is used");
assert.match(backup, /SHA-256/, "SHA-256 KDF hash is used");
assert.match(backup, /KDF_ITERATIONS = 200_000/, "PBKDF2 uses 200000 iterations");
assert.match(backup, /AES-GCM/, "AES-GCM encryption is used");
assert.match(backup, /new Uint8Array\(16\)/, "encrypted backups use a 16-byte salt");
assert.match(backup, /new Uint8Array\(12\)/, "encrypted backups use a 12-byte IV");
assert.match(backup, /비밀번호가 올바르지 않거나 손상된 백업입니다/, "decrypt failures use the requested error message");
assert.match(backup, /myledger\.preRestoreBackup\.v1/, "pre-restore safety backup key exists");
const backupKeysBlock = backup.match(/export const BACKUP_KEYS = \{[\s\S]*?\} as const;/)?.[0] ?? "";
assert.doesNotMatch(
  backupKeysBlock,
  /preRestoreBackup/,
  "pre-restore safety backup is not recursively included in downloaded backups"
);
assert.match(backup, /app: APP_ID/, "backup payload includes app");
assert.match(backup, /version: BACKUP_VERSION/, "backup payload includes version");
assert.match(backup, /createdAt:/, "backup payload includes createdAt");
assert.match(backup, /myledger\.txns\.v1/, "txns key included");
assert.match(backup, /myledger\.categories\.v1/, "categories key included");
assert.match(backup, /CURRENCY_STORAGE_KEY/, "currency preference included");
assert.match(backup, /REFRESH_INTERVAL_STORAGE_KEY/, "refresh interval preference included");
assert.match(backup, /RECURRING_RULES_KEY/, "recurring rules are included");
assert.match(backup, /RECURRING_MATERIALIZED_KEY/, "recurring materialized state is included");
assert.match(backup, /recurringRuleId/, "transaction recurringRuleId is accepted by backup validation");
assert.match(backup, /myledger\.settlementDay\.v1/, "settlement day is included");
assert.match(backup, /MONTHLY_CASH_KEY/, "monthly cash key is wired through backup");
assert.doesNotMatch(backup, /pendingUndo.*createBackupPayload/s, "pendingUndo is not backed up");
assert.match(backup, /value\.app !== APP_ID/, "wrong app is rejected");
assert.match(backup, /value\.version !== BACKUP_VERSION/, "wrong version is rejected");
assert.match(backup, /JSON\.parse/, "invalid JSON import is handled");
assert.match(backup, /writeBackupData\(prepared\.payload\.data\)/, "restore writes normalized payload data");

assert.equal(existsSync(cardPath), true, "BackupRestoreCard exists");
const card = readFileSync(cardPath, "utf8");
assert.match(card, /encryptExport/, "encrypted backup toggle state exists");
assert.match(card, /type="password"/, "backup password fields exist");
assert.match(card, /비밀번호를 잊으면 이 백업은 복구할 수 없습니다/, "irrecoverable-password warning is shown");
assert.match(card, /downloadEncryptedBackup/, "encrypted export is wired");
assert.match(card, /readBackupFile/, "backup import auto-detection is wired");
assert.match(card, /decryptBackupFile/, "encrypted import decrypt is wired");
assert.match(card, /window\.confirm/, "restore requires confirmation");
assert.match(card, /백업 파일 다운로드/, "download UI exists");
assert.match(card, /백업 파일에서 복원/, "restore UI exists");
assert.match(card, /복원할 데이터/, "restore preview is shown");
assert.match(card, /자동으로 안전백업/, "pre-restore safety backup guidance is shown");
assert.match(card, /invalidItemsRemoved/, "invalid item removal is reported");
assert.match(card, /지금 새로고침/, "restore completion offers an explicit reload button");
assert.match(card, /window\.location\.reload/, "reload button refreshes stale in-memory app state");

assert.equal(existsSync(deploymentPath), true, "deployment docs exist");
const docs = readFileSync(deploymentPath, "utf8");
const readme = readFileSync(readmePath, "utf8");
const security = readFileSync(join(root, "docs", "SECURITY.md"), "utf8");
assert.match(docs + readme, /localStorage-only|localStorage 전용/, "localStorage-only warning documented");
assert.match(docs + readme, /시드|개인키|API 키/, "sensitive key warning documented");
assert.match(security, /myledger\.preRestoreBackup\.v1/, "pre-restore safety backup key is documented");

const compilerOptions = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };
const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions }).outputText).toString("base64")}`;
const monthUrl = moduleUrl(readFileSync(join(root, "src/lib/month.ts"), "utf8"));
const formatUrl = moduleUrl(readFileSync(join(root, "src/lib/format.ts"), "utf8"));
const preferencesUrl = moduleUrl(readFileSync(join(root, "src/lib/preferences.ts"), "utf8"));
const recurringSource = readFileSync(join(root, "src/lib/recurringRules.ts"), "utf8").replace(
  '"./month"',
  `"${monthUrl}"`
);
const recurringUrl = moduleUrl(recurringSource);
const settlementSource = readFileSync(join(root, "src/lib/settlement.ts"), "utf8").replace(
  '"./month"',
  `"${monthUrl}"`
);
const settlementUrl = moduleUrl(settlementSource);
const monthlyCashUrl = moduleUrl(readFileSync(join(root, "src/lib/monthlyCash.ts"), "utf8"));
const runnableBackup = readFileSync(backupPath, "utf8")
  .replace('"./format"', `"${formatUrl}"`)
  .replace('"./preferences"', `"${preferencesUrl}"`)
  .replace('"./recurringRules"', `"${recurringUrl}"`)
  .replace('"./settlement"', `"${settlementUrl}"`)
  .replace('"./monthlyCash"', `"${monthlyCashUrl}"`);
const backupApi = await import(moduleUrl(runnableBackup));

const makeJsonFile = (value) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (typeof File === "function") return new File([text], "backup.json", { type: "application/json" });
  return { text: async () => text };
};

class MemoryStorage {
  #items = new Map();
  getItem(key) {
    return this.#items.has(key) ? this.#items.get(key) : null;
  }
  setItem(key, value) {
    this.#items.set(key, String(value));
  }
}

const storage = new MemoryStorage();
globalThis.localStorage = storage;

const validTxn = {
  id: 1,
  title: "Salary",
  cat: "salary",
  catLabel: "Salary",
  time: "6/20 09:00",
  date: "2026-06-20T09:00",
  amount: 1000,
  btcAt: 100_000_000,
  recurringRuleId: "rec_1",
};
const validCategory = {
  id: "salary",
  label: "Salary",
  group: "income",
  flow: "income",
  icon: "banknote",
  fg: "#4ade80",
};
const basePayload = {
  app: "my-ledger",
  version: 1,
  createdAt: "2026-06-25T00:00:00.000Z",
  data: {
    "myledger.txns.v1": { txns: [validTxn, { id: "bad" }], nextTxnId: 2 },
    "myledger.categories.v1": [validCategory, { id: 3 }],
    "myledger.heldBtc.v1": "0.25",
    "myledger.displayUnit.v1": "sats",
    "myledger.currency.v1": "BTC",
    "myledger.refreshInterval.v1": "60000",
    "myledger.btcSellRecords.v1": [
      {
        id: "sell_1",
        month: "2026-06",
        date: "2026-06-20",
        btcSold: 0.001,
        satsSold: 100000,
        btcKrwAtSell: 100_000_000,
        krwCovered: 100000,
        deficitKrwAtConfirm: 100000,
        deductedFromHeldBtc: true,
        deductedBtcAmount: 0.001,
        createdAt: "2026-06-20T09:00:00.000Z",
      },
    ],
    "myledger.settlementDay.v1": "31",
    "myledger.recurringRules.v1": [
      {
        id: "rec_1",
        title: "Rent",
        cat: "rent",
        isIncome: false,
        dayOfMonth: 31,
        lastAmount: 500000,
        createdAt: "2026-06-20T09:00:00.000Z",
      },
    ],
    "myledger.recurringMaterialized.v1": ["rec_1:2026-06"],
    "myledger.monthlyCash.v1": {
      "2026-06": 500_000,
      "2026-7": 100_000,
      "2026-08": -1,
      "2026-09": NaN,
    },
  },
};

assert.equal(backupApi.validateBackupPayload(basePayload), true, "valid legacy-compatible payload is accepted");
assert.equal(backupApi.validateBackupPayload({ ...basePayload, app: "other-app" }), false, "wrong app is rejected");
assert.equal(backupApi.validateBackupPayload({ ...basePayload, version: 2 }), false, "unsupported version is rejected");
assert.equal(
  backupApi.validateBackupPayload({ ...basePayload, data: { ...basePayload.data, "myledger.txns.v1": [] } }),
  false,
  "structurally invalid required transaction data blocks restore"
);
assert.equal(
  backupApi.validateBackupPayload({ ...basePayload, data: { ...basePayload.data, "myledger.categories.v1": {} } }),
  false,
  "structurally invalid required category data blocks restore"
);

const prepared = backupApi.prepareBackupRestore(basePayload);
assert.equal(prepared.preview.txnsCount, 1, "preview counts valid transactions");
assert.equal(prepared.preview.categoriesCount, 1, "preview counts valid categories");
assert.equal(prepared.preview.btcSellRecordsCount, 1, "preview counts BTC sale records");
assert.equal(prepared.preview.recurringRulesCount, 1, "preview counts recurring rules");
assert.equal(prepared.preview.recurringMaterializedCount, 1, "preview counts recurring materialized keys");
assert.equal(prepared.preview.invalidItemsRemoved, 5, "invalid array and monthly cash items are removed and counted");
assert.equal(prepared.preview.hasHeldBtc, true, "preview reports held BTC");
assert.equal(prepared.preview.hasSettlementDay, true, "preview reports settlement day");
assert.deepEqual(
  prepared.payload.data["myledger.monthlyCash.v1"],
  { "2026-06": 500_000 },
  "only valid monthly cash entries are restored"
);
assert.equal(
  prepared.payload.data["myledger.txns.v1"].txns[0].recurringRuleId,
  "rec_1",
  "transaction recurringRuleId survives backup restore preparation"
);
assert.equal(
  prepared.payload.data["myledger.recurringRules.v1"][0].id,
  "rec_1",
  "recurring rules survive backup restore preparation"
);
assert.deepEqual(
  prepared.payload.data["myledger.recurringMaterialized.v1"],
  ["rec_1:2026-06"],
  "recurring materialized keys survive backup restore preparation"
);

const oldTxns = { txns: [{ ...validTxn, id: 99, title: "Before restore" }], nextTxnId: 100 };
storage.setItem("myledger.txns.v1", JSON.stringify(oldTxns));
storage.setItem("myledger.categories.v1", JSON.stringify([validCategory]));
backupApi.restoreBackupPayload(basePayload);
const safetyBackup = JSON.parse(storage.getItem(backupApi.PRE_RESTORE_BACKUP_KEY));
assert.equal(
  safetyBackup.data["myledger.txns.v1"].txns[0].title,
  "Before restore",
  "current data is saved before restore"
);
assert.equal(
  JSON.parse(storage.getItem("myledger.txns.v1")).txns.length,
  1,
  "only sanitized transaction items are restored"
);
assert.deepEqual(
  JSON.parse(storage.getItem("myledger.monthlyCash.v1")),
  { "2026-06": 500_000 },
  "monthly cash is written during restore"
);
assert.equal(
  JSON.parse(storage.getItem("myledger.txns.v1")).txns[0].recurringRuleId,
  "rec_1",
  "transaction recurringRuleId is written during restore"
);
assert.equal(
  JSON.parse(storage.getItem("myledger.recurringRules.v1"))[0].id,
  "rec_1",
  "recurring rules are written during restore"
);
assert.deepEqual(
  JSON.parse(storage.getItem("myledger.recurringMaterialized.v1")),
  ["rec_1:2026-06"],
  "recurring materialized keys are written during restore"
);

const minimalPayload = {
  app: "my-ledger",
  version: 1,
  createdAt: "2026-06-25T00:00:00.000Z",
  data: {
    "myledger.txns.v1": { txns: [], nextTxnId: 1 },
    "myledger.categories.v1": [],
  },
};
assert.doesNotThrow(() => backupApi.prepareBackupRestore(minimalPayload), "optional backup fields may be absent");

const sampleEncryptedFile = {
  app: "my-ledger",
  enc: "aes-gcm",
  encVersion: 1,
  kdf: { name: "PBKDF2", hash: "SHA-256", iterations: 200000, salt: "YWJjZGVmZ2hpamtsbW5vcA==" },
  iv: "YWJjZGVmZ2hpamts",
  ciphertext: "Y2lwaGVydGV4dA==",
};
assert.equal(backupApi.isEncryptedBackupFile(sampleEncryptedFile), true, "encrypted wrapper is detected");
assert.equal(backupApi.isEncryptedBackupFile(minimalPayload), false, "plain payload is not treated as encrypted");

const plainRead = await backupApi.readBackupFile(makeJsonFile(minimalPayload));
assert.equal(plainRead.kind, "plain", "plain JSON backup is auto-detected");
const encryptedRead = await backupApi.readBackupFile(makeJsonFile(sampleEncryptedFile));
assert.equal(encryptedRead.kind, "encrypted", "encrypted JSON backup is auto-detected");

if (globalThis.crypto?.subtle) {
  const encrypted = await backupApi.encryptBackupPayload(minimalPayload, "pw1234");
  assert.equal(backupApi.isEncryptedBackupFile(encrypted), true, "real encrypted output is detected");
  const decrypted = await backupApi.decryptBackupFile(encrypted, "pw1234");
  assert.deepEqual(decrypted, minimalPayload, "encrypted backup round-trips with the right password");
  await assert.rejects(
    backupApi.decryptBackupFile(encrypted, "wrong"),
    /비밀번호가 올바르지 않거나 손상된 백업입니다/,
    "wrong password fails decrypt"
  );
} else {
  console.log("verify:backup encrypted round-trip skipped: Web Crypto unavailable");
}

console.log("verify:backup passed");
