const STORAGE_KEY = "myledger.btcSellRecords.v1";

export interface BtcSellRecord {
  id: string;
  month: string; // "YYYY-MM"
  date: string; // "YYYY-MM-DD"
  /** 지갑에서 나간 BTC (v2 실측). v1은 시세 역산값. */
  btcSold: number;
  satsSold: number;
  /** v2: 실효 매도가 (받은 원 ÷ 순 BTC). v1: 당시 앱 시세. */
  btcKrwAtSell: number;
  /** v2: 실제 받은 원화. v1: 입력 원화. */
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

  // --- schema v2 (optional; 기존 v1 레코드와 공존) ---
  schemaVersion?: 2;
  /** 실측: 지갑에서 나간 총 BTC (수수료 포함). btcSold와 동일값 권장. */
  btcSpentFromWallet?: number;
  /** 실측: 입금 원화. krwCovered와 동일값 권장. */
  krwReceived?: number;
  /** 저장 시점 앱 시세 스냅샷 (김프/괴리 계산용). */
  marketBtcKrwAtSell?: number;
  /** 온체인 전송 수수료 (sats). 통계용 선택 필드. */
  networkFeeSats?: number;
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

function isOptionalFiniteNumber(value: unknown): boolean {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
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
    typeof rec.createdAt === "string" &&
    (rec.schemaVersion === undefined || rec.schemaVersion === 2) &&
    isOptionalFiniteNumber(rec.btcSpentFromWallet) &&
    isOptionalFiniteNumber(rec.krwReceived) &&
    isOptionalFiniteNumber(rec.marketBtcKrwAtSell) &&
    isOptionalFiniteNumber(rec.networkFeeSats)
  );
}

/** 실효 매도가 = 받은 원 ÷ (나간 BTC − 수수료 BTC). 분모 ≤ 0 이면 null. */
export function calculateEffectiveSellPriceKrw(
  krwReceived: number,
  btcSpentFromWallet: number,
  networkFeeSats = 0
): number | null {
  if (!Number.isFinite(krwReceived) || krwReceived <= 0) return null;
  if (!Number.isFinite(btcSpentFromWallet) || btcSpentFromWallet <= 0) return null;
  const feeBtc =
    Number.isFinite(networkFeeSats) && networkFeeSats > 0 ? networkFeeSats / 1e8 : 0;
  const netBtc = btcSpentFromWallet - feeBtc;
  if (!(netBtc > 0)) return null;
  return krwReceived / netBtc;
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

function saveRecords(records: BtcSellRecord[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

function generateId(): string {
  return `sell_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function addBtcSellRecord(
  record: Omit<BtcSellRecord, "id" | "createdAt">
): BtcSellRecord | null {
  const btcSold = safeNum(record.btcSold);
  const createdAt = new Date().toISOString();
  const newRecord: BtcSellRecord = {
    ...record,
    id: generateId(),
    btcSold,
    satsSold: safeNum(record.satsSold),
    btcKrwAtSell: safeNum(record.btcKrwAtSell),
    krwCovered: safeNum(record.krwCovered),
    deficitKrwAtConfirm: safeNum(record.deficitKrwAtConfirm),
    deductedBtcAmount: record.deductedFromHeldBtc ? safeNum(record.deductedBtcAmount ?? btcSold) : undefined,
    schemaVersion: record.schemaVersion === 2 ? 2 : record.schemaVersion,
    btcSpentFromWallet:
      record.btcSpentFromWallet !== undefined ? safeNum(record.btcSpentFromWallet) : undefined,
    krwReceived: record.krwReceived !== undefined ? safeNum(record.krwReceived) : undefined,
    marketBtcKrwAtSell:
      record.marketBtcKrwAtSell !== undefined ? safeNum(record.marketBtcKrwAtSell) : undefined,
    networkFeeSats: record.networkFeeSats !== undefined ? safeNum(record.networkFeeSats) : undefined,
    createdAt,
  };
  const records = loadRecords();
  const createdAtMs = new Date(createdAt).getTime();
  const nearDuplicate = records.find((existing) => {
    const existingCreatedAtMs = new Date(existing.createdAt).getTime();
    return (
      existing.month === newRecord.month &&
      existing.krwCovered === newRecord.krwCovered &&
      Number.isFinite(existingCreatedAtMs) &&
      Math.abs(createdAtMs - existingCreatedAtMs) <= 5_000
    );
  });
  if (nearDuplicate) {
    console.warn("Possible duplicate BTC sell record saved within 5 seconds", {
      previousId: nearDuplicate.id,
      month: newRecord.month,
      krwCovered: newRecord.krwCovered,
    });
  }
  records.unshift(newRecord);
  return saveRecords(records) ? newRecord : null;
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
    btcSpentFromWallet:
      patch.btcSpentFromWallet !== undefined ? safeNum(patch.btcSpentFromWallet) : current.btcSpentFromWallet,
    krwReceived: patch.krwReceived !== undefined ? safeNum(patch.krwReceived) : current.krwReceived,
    marketBtcKrwAtSell:
      patch.marketBtcKrwAtSell !== undefined ? safeNum(patch.marketBtcKrwAtSell) : current.marketBtcKrwAtSell,
    networkFeeSats: patch.networkFeeSats !== undefined ? safeNum(patch.networkFeeSats) : current.networkFeeSats,
    schemaVersion: patch.schemaVersion !== undefined ? patch.schemaVersion : current.schemaVersion,
  };
  records[idx] = updated;
  return saveRecords(records) ? updated : null;
}

export function deleteBtcSellRecord(id: string): boolean {
  const records = loadRecords();
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  records.splice(idx, 1);
  return saveRecords(records);
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
