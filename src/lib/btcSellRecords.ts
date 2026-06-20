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
  const newRecord: BtcSellRecord = {
    ...record,
    id: generateId(),
    btcSold: safeNum(record.btcSold),
    satsSold: safeNum(record.satsSold),
    btcKrwAtSell: safeNum(record.btcKrwAtSell),
    krwCovered: safeNum(record.krwCovered),
    deficitKrwAtConfirm: safeNum(record.deficitKrwAtConfirm),
    createdAt: new Date().toISOString(),
  };
  const records = loadRecords();
  records.unshift(newRecord);
  saveRecords(records);
  return newRecord;
}

export function deleteBtcSellRecord(id: string): boolean {
  const records = loadRecords();
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  records.splice(idx, 1);
  saveRecords(records);
  return true;
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
