const FETCH_TIMEOUT_MS = 8000;

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

// 업비트 현재가 (KRW-BTC)
export async function fetchUpbitBtcKrw(): Promise<number> {
  const json = (await fetchJson("https://api.upbit.com/v1/ticker?markets=KRW-BTC")) as Array<{
    trade_price?: number;
  }>;
  const price = json?.[0]?.trade_price;
  if (typeof price !== "number" || !Number.isFinite(price)) throw new Error("Upbit: invalid response");
  return price;
}

// 바이낸스 현재가 (BTCUSDT)
export async function fetchBinanceBtcUsd(): Promise<number> {
  const json = (await fetchJson("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT")) as {
    price?: string;
  };
  const price = Number(json?.price);
  if (!Number.isFinite(price)) throw new Error("Binance: invalid response");
  return price;
}

// Coinbase BTC/USD 현물가 — Binance 지역 제한 또는 장애 시 폴백.
export async function fetchCoinbaseBtcUsd(): Promise<number> {
  const json = (await fetchJson("https://api.coinbase.com/v2/prices/BTC-USD/spot")) as {
    data?: { amount?: string };
  };
  const price = Number(json?.data?.amount);
  if (!Number.isFinite(price) || price <= 0) throw new Error("Coinbase BTC/USD: invalid response");
  return price;
}

export interface FrankfurterUsdKrwResult {
  value: number;
  referenceDate: string;
}

// USD/KRW 일일 기준환율. 실시간 시세가 아니므로 응답의 고시 기준일을 함께 보존한다.
export async function fetchFrankfurterUsdKrw(): Promise<FrankfurterUsdKrwResult> {
  const json = (await fetchJson("https://api.frankfurter.dev/v1/latest?from=USD&to=KRW")) as {
    date?: string;
    rates?: { KRW?: number };
  };
  const rate = json?.rates?.KRW;
  const referenceDate = json?.date;
  if (
    typeof rate !== "number" ||
    !Number.isFinite(rate) ||
    rate <= 0 ||
    typeof referenceDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)
  ) {
    throw new Error("Frankfurter FX: invalid response");
  }
  return { value: rate, referenceDate };
}

// Coinbase USD 기준 환율 — Frankfurter 장애 시 폴백.
export async function fetchCoinbaseUsdKrw(): Promise<number> {
  const json = (await fetchJson("https://api.coinbase.com/v2/exchange-rates?currency=USD")) as {
    data?: { rates?: { KRW?: string } };
  };
  const rate = Number(json?.data?.rates?.KRW);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Coinbase FX: invalid response");
  return rate;
}

export interface BtcUsdResult {
  value: number;
  source: "Binance" | "Coinbase";
}

export interface UsdKrwResult {
  value: number;
  source: "Frankfurter" | "Coinbase";
  referenceDate?: string;
}

export async function fetchBtcUsdWithFallback(
  primary: () => Promise<number> = fetchBinanceBtcUsd,
  fallback: () => Promise<number> = fetchCoinbaseBtcUsd
): Promise<BtcUsdResult> {
  try {
    return { value: await primary(), source: "Binance" };
  } catch (primaryError) {
    console.warn("Binance price fetch failed; trying Coinbase:", primaryError);
    return { value: await fallback(), source: "Coinbase" };
  }
}

export async function fetchUsdKrwWithFallback(
  primary: () => Promise<FrankfurterUsdKrwResult> = fetchFrankfurterUsdKrw,
  fallback: () => Promise<number> = fetchCoinbaseUsdKrw
): Promise<UsdKrwResult> {
  try {
    const result = await primary();
    return { ...result, source: "Frankfurter" };
  } catch (primaryError) {
    console.warn("Frankfurter FX fetch failed; trying Coinbase:", primaryError);
    return { value: await fallback(), source: "Coinbase" };
  }
}

export interface PriceSourceMeta {
  btcUsd: "Binance" | "Coinbase" | null;
  usdKrw: "Frankfurter" | "Coinbase" | null;
  fxReferenceDate?: string;
}

export interface PriceFetchResult {
  btcKRW?: number;
  btcUSD?: number;
  usdKRW?: number;
  sourceMeta: PriceSourceMeta;
  errors: string[];
}

// 세 소스를 독립적으로 호출 — 일부가 실패해도 성공한 값만 반환하고
// 실패한 항목은 errors에 담아 호출 측이 마지막 값을 유지하도록 한다.
export async function fetchLivePrices(): Promise<PriceFetchResult> {
  const [upbit, btcUsd, fx] = await Promise.allSettled([
    fetchUpbitBtcKrw(),
    fetchBtcUsdWithFallback(),
    fetchUsdKrwWithFallback(),
  ]);

  const result: PriceFetchResult = {
    errors: [],
    sourceMeta: { btcUsd: null, usdKrw: null },
  };

  if (upbit.status === "fulfilled") result.btcKRW = upbit.value;
  else {
    console.error("Upbit price fetch failed:", upbit.reason);
    result.errors.push("Upbit");
  }

  if (btcUsd.status === "fulfilled") {
    result.btcUSD = btcUsd.value.value;
    result.sourceMeta.btcUsd = btcUsd.value.source;
  }
  else {
    console.error("BTC/USD price fetch failed:", btcUsd.reason);
    result.errors.push("Binance");
  }

  if (fx.status === "fulfilled") {
    result.usdKRW = fx.value.value;
    result.sourceMeta.usdKrw = fx.value.source;
    result.sourceMeta.fxReferenceDate = fx.value.referenceDate;
  }
  else {
    console.error("FX rate fetch failed:", fx.reason);
    result.errors.push("FX");
  }

  return result;
}
