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

// USD/KRW 환율 (Frankfurter — ECB 기준, 무료/무인증/CORS 허용)
export async function fetchUsdKrwRate(): Promise<number> {
  const json = (await fetchJson("https://api.frankfurter.dev/v1/latest?from=USD&to=KRW")) as {
    rates?: { KRW?: number };
  };
  const rate = json?.rates?.KRW;
  if (typeof rate !== "number" || !Number.isFinite(rate)) throw new Error("FX: invalid response");
  return rate;
}

export type PriceSource = "Upbit" | "Binance" | "FX";

export interface PriceFetchResult {
  btcKRW?: number;
  btcUSD?: number;
  usdKRW?: number;
  errors: PriceSource[];
}

// 세 소스를 독립적으로 호출 — 일부가 실패해도 성공한 값만 반환하고
// 실패한 항목은 errors에 담아 호출 측이 마지막 값을 유지하도록 한다.
export async function fetchLivePrices(): Promise<PriceFetchResult> {
  const [upbit, binance, fx] = await Promise.allSettled([
    fetchUpbitBtcKrw(),
    fetchBinanceBtcUsd(),
    fetchUsdKrwRate(),
  ]);

  const result: PriceFetchResult = { errors: [] };

  if (upbit.status === "fulfilled") result.btcKRW = upbit.value;
  else {
    console.error("Upbit price fetch failed:", upbit.reason);
    result.errors.push("Upbit");
  }

  if (binance.status === "fulfilled") result.btcUSD = binance.value;
  else {
    console.error("Binance price fetch failed:", binance.reason);
    result.errors.push("Binance");
  }

  if (fx.status === "fulfilled") result.usdKRW = fx.value;
  else {
    console.error("FX rate fetch failed:", fx.reason);
    result.errors.push("FX");
  }

  return result;
}
