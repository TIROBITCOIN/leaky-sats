const STORAGE_KEY = "myledger.btcSellRecords.v1";

export interface BtcSellRecord {
  id: string;
  month: string; // "YYYY-MM"
  date: string; // "YYYY-MM-DD"
  btcSold: number;
  satsSold: number;
  btcKrwAtSell: number;
  krwCovered: number;
  deficitKrwAtConfirm: number;
  deductedFromHeldBtc: boolean;
  /**
   * deductedFromHeldBtc가 true일 때 실제로 보유 BTC에서 차감된 양의 스냅샷. 저장 시점의 btcSold와
   * 같은 값으로 시작하지만, 이후 btcSold가 수정돼도 이 값은 그대로 남아 있어 삭제/재수정 시 보유
   * BTC를 정확히 되돌릴 수 있다 — 기존 기록(이 필드가 없는 경우)은 옵션 취급해 안전하게 처리한다.
   */
  deductedBtcAmount?: number;
  note?: string;
  createdAt: string;
}

export interface MonthSellSummary {
  totalBtcSold: number;
  totalSatsSold: number;
  totalKrwCovered: number;
  count: number;
}

export interface YearSellSummary {
  totalBtcSold: number;
  totalSatsSold: number;
  totalKrwCovered: number;
  count: number;
}

function safeNum(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return v;
}

function isValidRecord(r: unknown): r is BtcSellRecord {
  if (!r || typeof r !== "object") return false;
  const rec = r as Partial<BtcSellRecord>;
  return (
    typeof rec.id === "string" &&
    typeof rec.month === "string" &&
    typeof rec.date === "string" &&
    typeof rec.btcSold === "number" && Number.isFinite(rec.btcSold) &&
    typeof rec.satsSold === "number" && Number.isFinite(rec.satsSold) &&
    typeof rec.btcKrwAtSell === "number" && Number.isFinite(rec.btcKrwAtSell) &&
    typeof rec.krwCovered === "number" && Number.isFinite(rec.krwCovered) &&
    typeof rec.deficitKrwAtConfirm === "number" && Number.isFinite(rec.deficitKrwAtConfirm) &&
    typeof rec.deductedFromHeldBtc === "boolean" &&
    (rec.deductedBtcAmount === undefined || (typeof rec.deductedBtcAmount === "number" && Number.isFinite(rec.deductedBtcAmount))) &&
    typeof rec.createdAt === "string"
  );
}

function loadRecords(): BtcSellRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const records: BtcSellRecord[] = [];
    for (const item of parsed) {
      if (isValidRecord(item) && !seen.has(item.id)) {
        seen.add(item.id);
        records.push(item);
      }
    }
    return records;
  } catch {
    return [];
  }
}

function saveRecords(records: BtcSellRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch { /* ignore */ }
}

function generateId(): string {
  return `sell_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function addBtcSellRecord(
  record: Omit<BtcSellRecord, "id" | "createdAt">
): BtcSellRecord {
  const btcSold = safeNum(record.btcSold);
  const newRecord: BtcSellRecord = {
    ...record,
    id: generateId(),
    btcSold,
    satsSold: safeNum(record.satsSold),
    btcKrwAtSell: safeNum(record.btcKrwAtSell),
    krwCovered: safeNum(record.krwCovered),
    deficitKrwAtConfirm: safeNum(record.deficitKrwAtConfirm),
    deductedBtcAmount: record.deductedFromHeldBtc ? safeNum(record.deductedBtcAmount ?? btcSold) : undefined,
    createdAt: new Date().toISOString(),
  };
  const records = loadRecords();
  records.unshift(newRecord);
  saveRecords(records);
  return newRecord;
}

/** 기존 판매 기록의 필드를 부분 수정한다. 보유 BTC 보정은 호출하는 쪽(SellConfirmModal)의 책임이다 —
 *  이 함수는 순수하게 저장된 레코드만 갱신한다. */
export function updateBtcSellRecord(
  id: string,
  patch: Partial<Omit<BtcSellRecord, "id" | "createdAt">>
): BtcSellRecord | null {
  const records = loadRecords();
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  const current = records[idx];
  const updated: BtcSellRecord = {
    ...current,
    ...patch,
    btcSold: patch.btcSold !== undefined ? safeNum(patch.btcSold) : current.btcSold,
    satsSold: patch.satsSold !== undefined ? safeNum(patch.satsSold) : current.satsSold,
    btcKrwAtSell: patch.btcKrwAtSell !== undefined ? safeNum(patch.btcKrwAtSell) : current.btcKrwAtSell,
    krwCovered: patch.krwCovered !== undefined ? safeNum(patch.krwCovered) : current.krwCovered,
    deficitKrwAtConfirm:
      patch.deficitKrwAtConfirm !== undefined ? safeNum(patch.deficitKrwAtConfirm) : current.deficitKrwAtConfirm,
  };
  records[idx] = updated;
  saveRecords(records);
  return updated;
}

export function deleteBtcSellRecord(id: string): boolean {
  const records = loadRecords();
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  records.splice(idx, 1);
  saveRecords(records);
  return true;
}

export function getBtcSellRecordById(id: string): BtcSellRecord | null {
  return loadRecords().find((r) => r.id === id) ?? null;
}

export function listBtcSellRecords(): BtcSellRecord[] {
  return loadRecords();
}

export function listBtcSellRecordsByMonth(month: string): BtcSellRecord[] {
  return loadRecords().filter((r) => r.month === month);
}

export function summarizeBtcSellRecordsByMonth(month: string): MonthSellSummary {
  const records = listBtcSellRecordsByMonth(month);
  let totalBtcSold = 0;
  let totalSatsSold = 0;
  let totalKrwCovered = 0;
  for (const r of records) {
    totalBtcSold += r.btcSold;
    totalSatsSold += r.satsSold;
    totalKrwCovered += r.krwCovered;
  }
  return { totalBtcSold, totalSatsSold, totalKrwCovered, count: records.length };
}

export function summarizeBtcSellRecordsByYear(year: string): YearSellSummary {
  const records = loadRecords().filter((r) => r.month.startsWith(year));
  let totalBtcSold = 0;
  let totalSatsSold = 0;
  let totalKrwCovered = 0;
  for (const r of records) {
    totalBtcSold += r.btcSold;
    totalSatsSold += r.satsSold;
    totalKrwCovered += r.krwCovered;
  }
  return { totalBtcSold, totalSatsSold, totalKrwCovered, count: records.length };
}

export { STORAGE_KEY as BTC_SELL_RECORDS_KEY };
