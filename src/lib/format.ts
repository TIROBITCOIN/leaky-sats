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
// 00:00은 시간 없는 거래로 간주하여 시간 부분을 생략합니다.
export const formatTxnTime = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  const hh = d.getHours();
  const mm = d.getMinutes();
  const hasTime = hh !== 0 || mm !== 0;
  const timeSuffix = hasTime ? ` ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}` : "";
  if (diffDays === 0) return `오늘${timeSuffix}`;
  if (diffDays === 1) return `어제${timeSuffix}`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일${timeSuffix}`;
};

// 거래 목록/홈 거래 카드용 날짜 전용 라벨 (시간 표시 없음)
export const formatTxnDateLabel = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "어제";
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};
