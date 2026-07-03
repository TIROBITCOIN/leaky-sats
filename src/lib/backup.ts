import { DISPLAY_UNIT_STORAGE_KEY } from "./format";
import {
  ALLOWED_REFRESH_INTERVALS,
  CURRENCY_STORAGE_KEY,
  DEFAULT_CURRENCY,
  DEFAULT_REFRESH_INTERVAL_MS,
  REFRESH_INTERVAL_STORAGE_KEY,
  normalizeCurrency,
  normalizeRefreshInterval,
} from "./preferences";
import { RECURRING_MATERIALIZED_KEY, RECURRING_RULES_KEY } from "./recurringRules";
import { normalizeSettlementDay } from "./settlement";
import { MONTHLY_CASH_KEY, PERIOD_START_BALANCE_KEY, normalizePeriodStartBalances } from "./periodStartBalance";
import type { CategoryDef, Txn } from "../types";

const APP_ID = "my-ledger";
const BACKUP_VERSION = 1;
const ENCRYPTION_VERSION = 1;
const KDF_ITERATIONS = 200_000;
const TXNS_KEY = "myledger.txns.v1";
const CATEGORIES_KEY = "myledger.categories.v1";
const HELD_BTC_KEY = "myledger.heldBtc.v1";
const BTC_SELL_RECORDS_KEY = "myledger.btcSellRecords.v1";
const SETTLEMENT_DAY_KEY = "myledger.settlementDay.v1";
export const PRE_RESTORE_BACKUP_KEY = "myledger.preRestoreBackup.v1";
export const LAST_BACKUP_AT_KEY = "myledger.lastBackupAt.v1";

export const BACKUP_KEYS = {
  txns: TXNS_KEY,
  categories: CATEGORIES_KEY,
  heldBtc: HELD_BTC_KEY,
  displayUnit: DISPLAY_UNIT_STORAGE_KEY,
  currency: CURRENCY_STORAGE_KEY,
  refreshInterval: REFRESH_INTERVAL_STORAGE_KEY,
  btcSellRecords: BTC_SELL_RECORDS_KEY,
  settlementDay: SETTLEMENT_DAY_KEY,
  periodStartBalances: PERIOD_START_BALANCE_KEY,
  recurringRules: RECURRING_RULES_KEY,
  recurringMaterialized: RECURRING_MATERIALIZED_KEY,
} as const;

export interface BackupPayload {
  app: typeof APP_ID;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  data: {
    [TXNS_KEY]: unknown;
    [CATEGORIES_KEY]: unknown;
    [HELD_BTC_KEY]?: unknown;
    [DISPLAY_UNIT_STORAGE_KEY]?: unknown;
    [CURRENCY_STORAGE_KEY]?: unknown;
    [REFRESH_INTERVAL_STORAGE_KEY]?: unknown;
    [BTC_SELL_RECORDS_KEY]?: unknown;
    [SETTLEMENT_DAY_KEY]?: unknown;
    [MONTHLY_CASH_KEY]?: unknown;
    [PERIOD_START_BALANCE_KEY]?: unknown;
    [RECURRING_RULES_KEY]?: unknown;
    [RECURRING_MATERIALIZED_KEY]?: unknown;
  };
}

export interface BackupPreview {
  txnsCount: number;
  categoriesCount: number;
  btcSellRecordsCount: number;
  recurringRulesCount: number;
  recurringMaterializedCount: number;
  hasHeldBtc: boolean;
  hasSettlementDay: boolean;
  invalidItemsRemoved: number;
}

export interface PreparedBackupRestore {
  payload: BackupPayload;
  preview: BackupPreview;
}

export interface EncryptedBackupFile {
  app: typeof APP_ID;
  enc: "aes-gcm";
  encVersion: number;
  kdf: {
    name: string;
    hash: string;
    iterations: number;
    salt: string;
  };
  iv: string;
  ciphertext: string;
}

export type ReadBackupFileResult =
  | { kind: "plain"; payload: BackupPayload }
  | { kind: "encrypted"; encrypted: EncryptedBackupFile };

export function loadLastBackupAt(): string | null {
  try {
    const value = localStorage.getItem(LAST_BACKUP_AT_KEY);
    if (!value || Number.isNaN(new Date(value).getTime())) return null;
    return value;
  } catch {
    return null;
  }
}

export function saveLastBackupAt(date = new Date()): string {
  const value = date.toISOString();
  localStorage.setItem(LAST_BACKUP_AT_KEY, value);
  return value;
}

function readParsedStorage(key: string, fallback: unknown) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function getCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) throw new Error("이 브라우저는 암호화 백업을 지원하지 않습니다.");
  return globalThis.crypto;
}

async function deriveBackupKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const crypto = getCrypto();
  const encodedPassword = new TextEncoder().encode(password);
  const material = await crypto.subtle.importKey("raw", encodedPassword, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: bytesToArrayBuffer(salt), iterations: KDF_ITERATIONS },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function validateTxnsData(value: unknown): boolean {
  return isRecord(value) && Array.isArray(value.txns);
}

function validateCategoriesData(value: unknown): boolean {
  return Array.isArray(value);
}

function isValidTxn(value: unknown): value is Txn {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "number" &&
    Number.isFinite(value.id) &&
    typeof value.title === "string" &&
    typeof value.cat === "string" &&
    typeof value.catLabel === "string" &&
    typeof value.time === "string" &&
    typeof value.date === "string" &&
    !Number.isNaN(new Date(value.date).getTime()) &&
    typeof value.amount === "number" &&
    Number.isFinite(value.amount) &&
    typeof value.btcAt === "number" &&
    Number.isFinite(value.btcAt) &&
    value.btcAt > 0 &&
    (value.memo === undefined || typeof value.memo === "string") &&
    (value.recurringRuleId === undefined || typeof value.recurringRuleId === "string")
  );
}

function isValidCategory(value: unknown): value is CategoryDef {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.label === "string" &&
    ["expense", "income", "invest"].includes(String(value.group)) &&
    ["expense", "income"].includes(String(value.flow)) &&
    typeof value.icon === "string" &&
    typeof value.fg === "string" &&
    (value.protected === undefined || typeof value.protected === "boolean")
  );
}

function isValidBtcSellRecord(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.month === "string" &&
    /^\d{4}-\d{2}$/.test(value.month) &&
    typeof value.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
    typeof value.btcSold === "number" &&
    Number.isFinite(value.btcSold) &&
    value.btcSold >= 0 &&
    typeof value.satsSold === "number" &&
    Number.isFinite(value.satsSold) &&
    value.satsSold >= 0 &&
    typeof value.btcKrwAtSell === "number" &&
    Number.isFinite(value.btcKrwAtSell) &&
    value.btcKrwAtSell > 0 &&
    typeof value.krwCovered === "number" &&
    Number.isFinite(value.krwCovered) &&
    value.krwCovered >= 0 &&
    typeof value.deficitKrwAtConfirm === "number" &&
    Number.isFinite(value.deficitKrwAtConfirm) &&
    value.deficitKrwAtConfirm >= 0 &&
    typeof value.deductedFromHeldBtc === "boolean" &&
    (value.deductedBtcAmount === undefined ||
      (typeof value.deductedBtcAmount === "number" &&
        Number.isFinite(value.deductedBtcAmount) &&
        value.deductedBtcAmount >= 0)) &&
    (value.note === undefined || typeof value.note === "string") &&
    typeof value.createdAt === "string"
  );
}

function isValidRecurringRule(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    typeof value.cat === "string" &&
    value.cat.length > 0 &&
    typeof value.isIncome === "boolean" &&
    typeof value.dayOfMonth === "number" &&
    Number.isInteger(value.dayOfMonth) &&
    value.dayOfMonth >= 1 &&
    value.dayOfMonth <= 31 &&
    (value.lastAmount === undefined ||
      (typeof value.lastAmount === "number" && Number.isFinite(value.lastAmount) && value.lastAmount > 0)) &&
    typeof value.createdAt === "string"
  );
}

function sanitizeUniqueArray(
  value: unknown,
  validator: (item: unknown) => boolean,
  getId: (item: Record<string, unknown>) => string | number
): { items: unknown[]; invalid: number } {
  if (!Array.isArray(value)) return { items: [], invalid: 1 };
  const seen = new Set<string | number>();
  const items: unknown[] = [];
  let invalid = 0;
  for (const item of value) {
    if (!validator(item) || !isRecord(item)) {
      invalid += 1;
      continue;
    }
    const id = getId(item);
    if (seen.has(id)) {
      invalid += 1;
      continue;
    }
    seen.add(id);
    items.push(item);
  }
  return { items, invalid };
}

function optionalValue(data: BackupPayload["data"], key: string): unknown {
  return key in data ? data[key as keyof BackupPayload["data"]] : undefined;
}

function sanitizeMonthlyCash(value: unknown): { items: Record<string, number>; invalid: number } {
  if (!isRecord(value)) return { items: {}, invalid: 1 };
  const items: Record<string, number> = {};
  let invalid = 0;
  for (const [month, rawKrw] of Object.entries(value)) {
    const krw = typeof rawKrw === "number" ? rawKrw : Number(rawKrw);
    if (!/^\d{4}-\d{2}$/.test(month) || !Number.isFinite(krw) || krw < 0) {
      invalid += 1;
      continue;
    }
    items[month] = krw;
  }
  return { items, invalid };
}

function sanitizePeriodStartBalances(value: unknown): { items: ReturnType<typeof normalizePeriodStartBalances>; invalid: number } {
  const items = normalizePeriodStartBalances(value);
  if (!isRecord(value)) return { items, invalid: value === undefined ? 0 : 1 };
  let invalid = 0;
  for (const [month, record] of Object.entries(value)) {
    if (!/^\d{4}-\d{2}$/.test(month) || !(month in items)) invalid += 1;
    else if (!isRecord(record) && typeof record !== "number" && typeof record !== "string") invalid += 1;
  }
  return { items, invalid };
}

export function createBackupPayload(): BackupPayload {
  return {
    app: APP_ID,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    data: {
      [TXNS_KEY]: readParsedStorage(TXNS_KEY, { txns: [], nextTxnId: Date.now() }),
      [CATEGORIES_KEY]: readParsedStorage(CATEGORIES_KEY, []),
      [HELD_BTC_KEY]: localStorage.getItem(HELD_BTC_KEY) ?? "0",
      [DISPLAY_UNIT_STORAGE_KEY]: localStorage.getItem(DISPLAY_UNIT_STORAGE_KEY) ?? "BTC",
      [CURRENCY_STORAGE_KEY]: localStorage.getItem(CURRENCY_STORAGE_KEY) ?? DEFAULT_CURRENCY,
      [REFRESH_INTERVAL_STORAGE_KEY]:
        localStorage.getItem(REFRESH_INTERVAL_STORAGE_KEY) ?? String(DEFAULT_REFRESH_INTERVAL_MS),
      [BTC_SELL_RECORDS_KEY]: readParsedStorage(BTC_SELL_RECORDS_KEY, []),
      [SETTLEMENT_DAY_KEY]: localStorage.getItem(SETTLEMENT_DAY_KEY) ?? "1",
      [PERIOD_START_BALANCE_KEY]: readParsedStorage(PERIOD_START_BALANCE_KEY, {}),
      [RECURRING_RULES_KEY]: readParsedStorage(RECURRING_RULES_KEY, []),
      [RECURRING_MATERIALIZED_KEY]: readParsedStorage(RECURRING_MATERIALIZED_KEY, []),
    },
  };
}

export function validateBackupPayload(value: unknown): value is BackupPayload {
  if (!isRecord(value)) return false;
  if (
    value.app !== APP_ID ||
    value.version !== BACKUP_VERSION ||
    typeof value.createdAt !== "string" ||
    Number.isNaN(new Date(value.createdAt).getTime())
  ) {
    return false;
  }
  if (!isRecord(value.data)) return false;
  if (!(TXNS_KEY in value.data) || !(CATEGORIES_KEY in value.data)) return false;
  return validateTxnsData(value.data[TXNS_KEY]) && validateCategoriesData(value.data[CATEGORIES_KEY]);
}

export function isEncryptedBackupFile(value: unknown): value is EncryptedBackupFile {
  if (!isRecord(value) || !isRecord(value.kdf)) return false;
  return (
    value.app === APP_ID &&
    value.enc === "aes-gcm" &&
    value.encVersion === ENCRYPTION_VERSION &&
    value.kdf.name === "PBKDF2" &&
    value.kdf.hash === "SHA-256" &&
    value.kdf.iterations === KDF_ITERATIONS &&
    typeof value.kdf.salt === "string" &&
    value.kdf.salt.length > 0 &&
    typeof value.iv === "string" &&
    value.iv.length > 0 &&
    typeof value.ciphertext === "string" &&
    value.ciphertext.length > 0
  );
}

export async function encryptBackupPayload(payload: BackupPayload, password: string): Promise<EncryptedBackupFile> {
  if (!password) throw new Error("백업 비밀번호를 입력해주세요.");
  const crypto = getCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(password, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: bytesToArrayBuffer(iv) }, key, bytesToArrayBuffer(plaintext))
  );

  return {
    app: APP_ID,
    enc: "aes-gcm",
    encVersion: ENCRYPTION_VERSION,
    kdf: {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: KDF_ITERATIONS,
      salt: bytesToBase64(salt),
    },
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
  };
}

export async function decryptBackupFile(file: EncryptedBackupFile, password: string): Promise<BackupPayload> {
  try {
    if (!isEncryptedBackupFile(file) || !password) throw new Error("invalid encrypted backup");
    const salt = base64ToBytes(file.kdf.salt);
    const iv = base64ToBytes(file.iv);
    const ciphertext = base64ToBytes(file.ciphertext);
    const key = await deriveBackupKey(password, salt);
    const plaintext = await getCrypto().subtle.decrypt(
      { name: "AES-GCM", iv: bytesToArrayBuffer(iv) },
      key,
      bytesToArrayBuffer(ciphertext)
    );
    const parsed: unknown = JSON.parse(new TextDecoder().decode(plaintext));
    if (!validateBackupPayload(parsed)) throw new Error("invalid backup payload");
    return parsed;
  } catch {
    throw new Error("비밀번호가 올바르지 않거나 손상된 백업입니다.");
  }
}

export function prepareBackupRestore(payload: BackupPayload): PreparedBackupRestore {
  if (!validateBackupPayload(payload)) {
    throw new Error("복원할 수 없는 백업 데이터입니다.");
  }

  const rawTxnsState = payload.data[TXNS_KEY] as Record<string, unknown>;
  const txnsResult = sanitizeUniqueArray(rawTxnsState.txns, isValidTxn, (item) => item.id as number);
  const categoryResult = sanitizeUniqueArray(payload.data[CATEGORIES_KEY], isValidCategory, (item) => item.id as string);
  let invalidItemsRemoved = txnsResult.invalid + categoryResult.invalid;

  const txns = txnsResult.items as Txn[];
  const maxTxnId = txns.reduce((max, txn) => Math.max(max, txn.id), 0);
  const storedNextId =
    typeof rawTxnsState.nextTxnId === "number" && Number.isFinite(rawTxnsState.nextTxnId)
      ? rawTxnsState.nextTxnId
      : 0;

  const data: BackupPayload["data"] = {
    [TXNS_KEY]: {
      txns,
      nextTxnId: Math.max(storedNextId, maxTxnId + 1, 1),
    },
    [CATEGORIES_KEY]: categoryResult.items,
  };

  const rawHeldBtc = optionalValue(payload.data, HELD_BTC_KEY);
  const heldBtc = typeof rawHeldBtc === "number" ? rawHeldBtc : Number(rawHeldBtc);
  const hasHeldBtc = rawHeldBtc !== undefined && Number.isFinite(heldBtc) && heldBtc >= 0;
  if (hasHeldBtc) data[HELD_BTC_KEY] = String(heldBtc);
  else if (rawHeldBtc !== undefined) invalidItemsRemoved += 1;

  const rawDisplayUnit = optionalValue(payload.data, DISPLAY_UNIT_STORAGE_KEY);
  if (rawDisplayUnit === "BTC" || rawDisplayUnit === "sats") {
    data[DISPLAY_UNIT_STORAGE_KEY] = rawDisplayUnit;
  } else if (rawDisplayUnit !== undefined) {
    invalidItemsRemoved += 1;
  }

  const rawCurrency = optionalValue(payload.data, CURRENCY_STORAGE_KEY);
  if (rawCurrency === "KRW" || rawCurrency === "BTC") {
    data[CURRENCY_STORAGE_KEY] = normalizeCurrency(rawCurrency);
  } else if (rawCurrency !== undefined) {
    invalidItemsRemoved += 1;
  }

  const rawRefreshInterval = optionalValue(payload.data, REFRESH_INTERVAL_STORAGE_KEY);
  const refreshInterval = Number(rawRefreshInterval);
  if (
    rawRefreshInterval !== undefined &&
    ALLOWED_REFRESH_INTERVALS.includes(refreshInterval as (typeof ALLOWED_REFRESH_INTERVALS)[number])
  ) {
    data[REFRESH_INTERVAL_STORAGE_KEY] = String(normalizeRefreshInterval(refreshInterval));
  } else if (rawRefreshInterval !== undefined) {
    invalidItemsRemoved += 1;
  }

  const rawSellRecords = optionalValue(payload.data, BTC_SELL_RECORDS_KEY);
  let btcSellRecords: unknown[] = [];
  if (rawSellRecords !== undefined) {
    const result = sanitizeUniqueArray(rawSellRecords, isValidBtcSellRecord, (item) => item.id as string);
    btcSellRecords = result.items;
    invalidItemsRemoved += result.invalid;
    data[BTC_SELL_RECORDS_KEY] = btcSellRecords;
  }

  const rawSettlementDay = optionalValue(payload.data, SETTLEMENT_DAY_KEY);
  const settlementDay = Number(rawSettlementDay);
  const hasSettlementDay =
    rawSettlementDay !== undefined &&
    Number.isInteger(settlementDay) &&
    settlementDay >= 1 &&
    settlementDay <= 31;
  if (hasSettlementDay) data[SETTLEMENT_DAY_KEY] = String(normalizeSettlementDay(settlementDay));
  else if (rawSettlementDay !== undefined) invalidItemsRemoved += 1;

  const rawMonthlyCash = optionalValue(payload.data, MONTHLY_CASH_KEY);
  const rawPeriodStartBalances = optionalValue(payload.data, PERIOD_START_BALANCE_KEY);
  if (rawPeriodStartBalances !== undefined) {
    const result = sanitizePeriodStartBalances(rawPeriodStartBalances);
    invalidItemsRemoved += result.invalid;
    data[PERIOD_START_BALANCE_KEY] = result.items;
  }
  if (rawMonthlyCash !== undefined) {
    const result = sanitizeMonthlyCash(rawMonthlyCash);
    invalidItemsRemoved += result.invalid;
    if (!(PERIOD_START_BALANCE_KEY in data)) {
      data[PERIOD_START_BALANCE_KEY] = Object.fromEntries(
        Object.entries(result.items).map(([month, startBalanceKrw]) => [month, { startBalanceKrw }])
      );
    }
  }

  const rawRecurringRules = optionalValue(payload.data, RECURRING_RULES_KEY);
  let recurringRules: unknown[] = [];
  if (rawRecurringRules !== undefined) {
    const result = sanitizeUniqueArray(rawRecurringRules, isValidRecurringRule, (item) => item.id as string);
    recurringRules = result.items;
    invalidItemsRemoved += result.invalid;
    data[RECURRING_RULES_KEY] = recurringRules;
  }

  const rawRecurringMaterialized = optionalValue(payload.data, RECURRING_MATERIALIZED_KEY);
  let recurringMaterialized: string[] = [];
  if (rawRecurringMaterialized !== undefined) {
    if (Array.isArray(rawRecurringMaterialized)) {
      const seen = new Set<string>();
      for (const item of rawRecurringMaterialized) {
        if (typeof item !== "string" || !/^.+:\d{4}-\d{2}$/.test(item) || seen.has(item)) {
          invalidItemsRemoved += 1;
          continue;
        }
        seen.add(item);
        recurringMaterialized.push(item);
      }
    } else {
      invalidItemsRemoved += 1;
    }
    data[RECURRING_MATERIALIZED_KEY] = recurringMaterialized;
  }

  return {
    payload: {
      app: APP_ID,
      version: BACKUP_VERSION,
      createdAt: payload.createdAt,
      data,
    },
    preview: {
      txnsCount: txns.length,
      categoriesCount: categoryResult.items.length,
      btcSellRecordsCount: btcSellRecords.length,
      recurringRulesCount: recurringRules.length,
      recurringMaterializedCount: recurringMaterialized.length,
      hasHeldBtc,
      hasSettlementDay,
      invalidItemsRemoved,
    },
  };
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

export async function downloadEncryptedBackup(password: string): Promise<void> {
  const payload = createBackupPayload();
  const day = payload.createdAt.slice(0, 10);
  const encrypted = await encryptBackupPayload(payload, password);
  const blob = new Blob([JSON.stringify(encrypted, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `my-ledger-backup-${day}-encrypted.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function readBackupFile(file: File): Promise<ReadBackupFileResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("백업 파일의 JSON 형식이 올바르지 않습니다.");
  }

  if (isEncryptedBackupFile(parsed)) return { kind: "encrypted", encrypted: parsed };
  if (validateBackupPayload(parsed)) return { kind: "plain", payload: parsed };
  throw new Error("My Ledger 백업 파일이 아닙니다.");
}

export async function parseBackupFile(file: File): Promise<BackupPayload> {
  const result = await readBackupFile(file);
  if (result.kind === "plain") return result.payload;
  throw new Error("My Ledger 백업 파일이 아니거나 지원하지 않는 백업 버전입니다.");
}

function writeBackupData(data: BackupPayload["data"]) {
  localStorage.setItem(TXNS_KEY, JSON.stringify(data[TXNS_KEY]));
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(data[CATEGORIES_KEY]));
  if (HELD_BTC_KEY in data) localStorage.setItem(HELD_BTC_KEY, String(data[HELD_BTC_KEY]));
  if (DISPLAY_UNIT_STORAGE_KEY in data) {
    localStorage.setItem(DISPLAY_UNIT_STORAGE_KEY, String(data[DISPLAY_UNIT_STORAGE_KEY]));
  }
  if (CURRENCY_STORAGE_KEY in data) localStorage.setItem(CURRENCY_STORAGE_KEY, String(data[CURRENCY_STORAGE_KEY]));
  if (REFRESH_INTERVAL_STORAGE_KEY in data) {
    localStorage.setItem(REFRESH_INTERVAL_STORAGE_KEY, String(data[REFRESH_INTERVAL_STORAGE_KEY]));
  }
  if (BTC_SELL_RECORDS_KEY in data) {
    localStorage.setItem(BTC_SELL_RECORDS_KEY, JSON.stringify(data[BTC_SELL_RECORDS_KEY]));
  }
  if (SETTLEMENT_DAY_KEY in data) localStorage.setItem(SETTLEMENT_DAY_KEY, String(data[SETTLEMENT_DAY_KEY]));
  localStorage.removeItem(MONTHLY_CASH_KEY);
  if (PERIOD_START_BALANCE_KEY in data) {
    localStorage.setItem(PERIOD_START_BALANCE_KEY, JSON.stringify(data[PERIOD_START_BALANCE_KEY]));
  }
  if (RECURRING_RULES_KEY in data) {
    localStorage.setItem(RECURRING_RULES_KEY, JSON.stringify(data[RECURRING_RULES_KEY]));
  }
  if (RECURRING_MATERIALIZED_KEY in data) {
    localStorage.setItem(RECURRING_MATERIALIZED_KEY, JSON.stringify(data[RECURRING_MATERIALIZED_KEY]));
  }
}

export function restoreBackupPayload(payload: BackupPayload) {
  const prepared = prepareBackupRestore(payload);
  const safetyBackup = createBackupPayload();
  localStorage.setItem(PRE_RESTORE_BACKUP_KEY, JSON.stringify(safetyBackup));

  try {
    writeBackupData(prepared.payload.data);
  } catch {
    try {
      writeBackupData(prepareBackupRestore(safetyBackup).payload.data);
    } catch {
      // 안전백업 key는 남겨 두어 수동 복구가 가능하게 한다.
    }
    throw new Error("복원 중 저장에 실패했습니다. 기존 데이터 안전백업은 보존되었습니다.");
  }
}
