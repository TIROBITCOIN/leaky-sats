// 과거에 저장된 카테고리 라벨을 강제 마이그레이션 없이 현재 용어로 표시하기 위한 alias.
const LEGACY_CATEGORY_LABEL_ALIASES: Record<string, string> = {
  "BTC 매수": "DCA / BTC 매수",
  "BTC 구매": "DCA / BTC 매수",
  "BTC 매도": "BTC 판매",
};

export function formatCategoryLabel(label: string): string {
  return LEGACY_CATEGORY_LABEL_ALIASES[label] ?? label;
}

export const fmtKRW = (n: number): string =>
  (n < 0 ? "-" : "") + "₩" + Math.abs(n).toLocaleString("ko-KR");

/** 좁은 달력 셀에 맞춘 축약 원화 표시. 1만원 이상이면 "X.X만", 미만이면 보통 천단위 콤마. */
export const fmtKRWCompact = (n: number): string => {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 10_000) {
    const man = abs / 10_000;
    const digits = man >= 100 ? Math.round(man).toString() : man.toFixed(1).replace(/\.0$/, "");
    return `${sign}₩${digits}만`;
  }
  return `${sign}₩${abs.toLocaleString("ko-KR")}`;
};

// 0.001 BTC 이상이면 BTC 단위, 미만이면 sats 단위로 표시. rate는 항상 "현재 시세".
export const fmtBTC = (krw: number, rate: number): string => {
  const btc = krw / rate;
  if (Math.abs(btc) >= 0.001) {
    return `≈ ${btc >= 0 ? "" : "-"}${Math.abs(btc).toFixed(5)} BTC`;
  }
  const sats = Math.round((krw / rate) * 1e8);
  return `≈ ${sats.toLocaleString("en-US")} sats`;
};

export const krwToBtc = (krw: number, rate: number): number => krw / rate;

export const krwToSats = (krw: number, rate: number): number => Math.round((krw / rate) * 1e8);

export const fmtSats = (sats: number): string => `${sats.toLocaleString("en-US")} sats`;

export type BtcUnit = "BTC" | "sats";

export const DISPLAY_UNIT_STORAGE_KEY = "myledger.displayUnit.v1";

export function loadBtcUnit(): BtcUnit {
  try {
    const raw = localStorage.getItem(DISPLAY_UNIT_STORAGE_KEY);
    if (raw === "sats") return "sats";
  } catch { /* fall through */ }
  return "BTC";
}

export function saveBtcUnit(unit: BtcUnit) {
  try {
    localStorage.setItem(DISPLAY_UNIT_STORAGE_KEY, unit);
  } catch { /* ignore */ }
}

/** Format a BTC amount respecting the display unit. Removes trailing zeros for BTC. */
export function fmtBtcValue(btc: number, unit: BtcUnit): string {
  if (!Number.isFinite(btc)) return unit === "sats" ? "0 sats" : "0 BTC";
  if (unit === "sats") {
    const sats = Math.round(btc * 1e8);
    return `${sats.toLocaleString("en-US")} sats`;
  }
  // BTC with trailing zero removal
  const fixed = btc.toFixed(8);
  const trimmed = fixed.replace(/\.?0+$/, "");
  return `${trimmed} BTC`;
}

// 김프 = (업비트KRW − 바이낸스USD × USDKRW) / (바이낸스USD × USDKRW) × 100
export const MAX_REASONABLE_KIMCHI_PREMIUM_ABS = 20;

export const kimchiPremium = (btcKRW: number, btcUSD: number, usdKRW: number): number => {
  const fair = btcUSD * usdKRW;
  if (!Number.isFinite(btcKRW) || !Number.isFinite(fair) || fair <= 0) return Number.NaN;
  return ((btcKRW - fair) / fair) * 100;
};

// <input type="datetime-local"> 기본값으로 쓸 "YYYY-MM-DDTHH:mm" 문자열
export const nowDatetimeLocal = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
};

// "오늘 HH:MM" / "어제 HH:MM" / "M월 D일" 형태의 거래 시각 라벨 생성
export const formatTxnTime = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (diffDays === 0) return `오늘 ${hh}:${mm}`;
  if (diffDays === 1) return `어제 ${hh}:${mm}`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};
