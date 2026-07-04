export const DEFAULT_NETWORK_FEE_SATS = 500;

interface MempoolFeeResponse {
  feeSats?: number;
}

export async function fetchRecommendedNetworkFeeSats(): Promise<number> {
  try {
    const response = await fetch("/api/mempool-fees");
    if (!response.ok) return DEFAULT_NETWORK_FEE_SATS;

    const data = (await response.json()) as MempoolFeeResponse;
    const feeSats = Number(data.feeSats);
    return Number.isFinite(feeSats) && feeSats > 0 ? Math.round(feeSats) : DEFAULT_NETWORK_FEE_SATS;
  } catch {
    return DEFAULT_NETWORK_FEE_SATS;
  }
}
