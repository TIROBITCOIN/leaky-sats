type VercelResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

const MEMPOOL_RECOMMENDED_FEES_URL = "https://mempool.space/api/v1/fees/recommended";
const FETCH_TIMEOUT_MS = 5000;
const ESTIMATED_TX_VBYTES = 140;
const FALLBACK_FEE_SATS = 500;

export default async function handler(_req: unknown, res: VercelResponse) {
  try {
    const response = await fetch(MEMPOOL_RECOMMENDED_FEES_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`mempool ${response.status}`);

    const data = (await response.json()) as { fastestFee?: number };
    const fastestFee = Number(data.fastestFee);
    if (!Number.isFinite(fastestFee) || fastestFee <= 0) throw new Error("invalid");

    const feeSats = Math.max(FALLBACK_FEE_SATS, Math.round(fastestFee * ESTIMATED_TX_VBYTES));
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
    res.status(200).json({ fastestFee, estimatedVbytes: ESTIMATED_TX_VBYTES, feeSats });
  } catch {
    res.status(200).json({ feeSats: FALLBACK_FEE_SATS, fallback: true });
  }
}
