const APP_ID = "my-ledger";
const BACKUP_VERSION = 1;
const TXNS_KEY = "myledger.txns.v1";
const CATEGORIES_KEY = "myledger.categories.v1";

export const BACKUP_KEYS = {
  txns: TXNS_KEY,
  categories: CATEGORIES_KEY,
} as const;

export interface BackupPayload {
  app: typeof APP_ID;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  data: {
    [TXNS_KEY]: unknown;
    [CATEGORIES_KEY]: unknown;
  };
}

function readParsedStorage(key: string, fallback: unknown) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  return JSON.parse(raw);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateTxnsData(value: unknown): boolean {
  return isRecord(value) && Array.isArray(value.txns);
}

function validateCategoriesData(value: unknown): boolean {
  return Array.isArray(value);
}

export function createBackupPayload(): BackupPayload {
  return {
    app: APP_ID,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    data: {
      [TXNS_KEY]: readParsedStorage(TXNS_KEY, { txns: [], nextTxnId: Date.now() }),
      [CATEGORIES_KEY]: readParsedStorage(CATEGORIES_KEY, []),
    },
  };
}

export function validateBackupPayload(value: unknown): value is BackupPayload {
  if (!isRecord(value)) return false;
  if (value.app !== APP_ID || value.version !== BACKUP_VERSION || typeof value.createdAt !== "string") return false;
  if (!isRecord(value.data)) return false;
  if (!(TXNS_KEY in value.data) || !(CATEGORIES_KEY in value.data)) return false;
  return validateTxnsData(value.data[TXNS_KEY]) && validateCategoriesData(value.data[CATEGORIES_KEY]);
}

export function downloadBackup() {
  const payload = createBackupPayload();
  const day = payload.createdAt.slice(0, 10);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `my-ledger-backup-${day}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function parseBackupFile(file: File): Promise<BackupPayload> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("백업 파일의 JSON 형식이 올바르지 않습니다.");
  }

  if (!validateBackupPayload(parsed)) {
    throw new Error("My Ledger 백업 파일이 아니거나 지원하지 않는 백업 버전입니다.");
  }

  return parsed;
}

export function restoreBackupPayload(payload: BackupPayload) {
  if (!validateBackupPayload(payload)) {
    throw new Error("복원할 수 없는 백업 데이터입니다.");
  }

  localStorage.setItem(TXNS_KEY, JSON.stringify(payload.data[TXNS_KEY]));
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(payload.data[CATEGORIES_KEY]));
}
