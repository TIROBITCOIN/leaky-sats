import type { PriceStatus } from "../state/LedgerContext";
import { PRICE_SOURCE_FIELD, type PriceSourceUpdatedAt } from "./priceFreshness";
import type { PriceSource } from "./priceApi";

export type PriceTone = "live" | "loading" | "stale" | "offline";

// isFallback: 아직 한 번도 성공하지 못한 소스가 있음. isStale: 직전 갱신에서 실패한 소스가 있음.
export function getPriceTone(status: PriceStatus, isFallback: boolean, isStale = false): PriceTone {
  if (isFallback) return status === "loading" ? "loading" : "offline";
  if (status === "loading") return "loading";
  if (status === "error" || isStale) return "stale";
  return "live";
}

export const PRICE_TONE_COLOR: Record<PriceTone, string> = {
  live: "#4ade80",
  loading: "#8a8a8a",
  stale: "#f7931a",
  offline: "#f87171",
};

export function formatUpdatedAt(updatedAt: number | null): string {
  return updatedAt ? new Date(updatedAt).toLocaleTimeString("ko-KR") : "";
}

export function formatStalePriceStatus(
  staleSources: PriceSource[],
  sourceUpdatedAt: PriceSourceUpdatedAt
): string {
  if (staleSources.length === 0) return "";
  const details = staleSources.map((source) => {
    const updatedAt = sourceUpdatedAt[PRICE_SOURCE_FIELD[source]];
    const time = formatUpdatedAt(updatedAt);
    return time ? `${source} ${time}` : `${source} 성공 기록 없음`;
  });
  return `일부 시세 지연 · ${details.join(", ")}`;
}
