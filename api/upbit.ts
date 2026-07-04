type VercelResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

const UPBIT_BTC_KRW_URL = "https://api.upbit.com/v1/ticker?markets=KRW-BTC";
const FETCH_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 1_000;

let cached: { btcKrw: number; cachedAt: number } | null = null;
let inFlight: Promise<number> | null = null;

async function fetchUpbitBtcKrw(): Promise<number> {
  const response = await fetch(UPBIT_BTC_KRW_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`upbit ${response.status}`);

  const data = (await response.json()) as Array<{ trade_price?: number }>;
  const price = Array.isArray(data) ? data[0]?.trade_price : undefined;
  if (typeof price !== "number" || !Number.isFinite(price)) throw new Error("invalid");
  return price;
}

export default async function handler(_req: unknown, res: VercelResponse) {
  try {
    const now = Date.now();
    if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
      res.setHeader("Cache-Control", "s-maxage=1, stale-while-revalidate=5");
      res.status(200).json({ btcKrw: cached.btcKrw, cached: true });
      return;
    }

    inFlight ??= fetchUpbitBtcKrw().finally(() => {
      inFlight = null;
    });
    const price = await inFlight;
    cached = { btcKrw: price, cachedAt: Date.now() };

    res.setHeader("Cache-Control", "s-maxage=1, stale-while-revalidate=5");
    res.status(200).json({ btcKrw: price });
  } catch {
    if (cached) {
      res.setHeader("Cache-Control", "s-maxage=1, stale-while-revalidate=5");
      res.status(200).json({ btcKrw: cached.btcKrw, cached: true, stale: true });
      return;
    }
    res.status(502).json({ error: "upbit_unavailable" });
  }
}
