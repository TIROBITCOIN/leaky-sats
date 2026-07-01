import type { PriceFetchResult, PriceSource } from "./priceApi";

export interface PriceSourceUpdatedAt {
  btcKRW: number | null;
  btcUSD: number | null;
  usdKRW: number | null;
}

export interface PriceFreshness {
  lastOkAt: PriceSourceUpdatedAt;
  staleSources: PriceSource[];
}

export const PRICE_SOURCE_FIELD: Record<PriceSource, keyof PriceSourceUpdatedAt> = {
  Upbit: "btcKRW",
  Binance: "btcUSD",
  FX: "usdKRW",
};

export function createInitialPriceFreshness(): PriceFreshness {
  return {
    lastOkAt: { btcKRW: null, btcUSD: null, usdKRW: null },
    staleSources: [],
  };
}

export function applyPriceFetchResult(
  previous: PriceFreshness,
  result: PriceFetchResult,
  settledAt = Date.now()
): PriceFreshness {
  return {
    lastOkAt: {
      btcKRW: result.btcKRW !== undefined && !result.btcKrwIsFallback ? settledAt : previous.lastOkAt.btcKRW,
      btcUSD: result.btcUSD !== undefined ? settledAt : previous.lastOkAt.btcUSD,
      usdKRW: result.usdKRW !== undefined ? settledAt : previous.lastOkAt.usdKRW,
    },
    staleSources: [...result.errors],
  };
}

export function hasPriceFallback(freshness: PriceFreshness): boolean {
  return Object.values(freshness.lastOkAt).some((updatedAt) => updatedAt === null);
}

export function isPriceStale(freshness: PriceFreshness): boolean {
  return freshness.staleSources.length > 0;
}

export function getLatestPriceUpdateAt(freshness: PriceFreshness): number | null {
  const timestamps = Object.values(freshness.lastOkAt).filter((value): value is number => value !== null);
  return timestamps.length > 0 ? Math.max(...timestamps) : null;
}
