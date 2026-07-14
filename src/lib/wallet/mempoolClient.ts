/**
 * Mempool/Esplora HTTP helpers (browser-safe).
 * Pattern ported from Atlas apps/api/src/mempool/request.ts.
 */

/** Tailscale / home-lab RTT can exceed a few seconds on mobile. */
export const MEMPOOL_REQUEST_TIMEOUT_MS = 20_000;
export const MEMPOOL_LOOKUP_CONCURRENCY = 4;
export const MEMPOOL_RETRY_COUNT = 1;

export class MempoolHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly retryAfterMs?: number
  ) {
    super(`HTTP ${status}`);
    this.name = "MempoolHttpError";
  }
}

/** Parses Retry-After delta-seconds or an HTTP date into a delay in milliseconds. */
export function parseRetryAfterMs(value: string | null, now = Date.now()): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds * 1000)) : undefined;
  }

  const timestamp = Date.parse(trimmed);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : undefined;
}

/** Normalize base URL: strip trailing slashes. */
export function normalizeMempoolBaseUrl(base: string): string {
  return base
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/blocks\/tip\/height$/i, "")
    .replace(/\/address\/[^/]+(?:\/utxo)?$/i, "");
}

export function addressUtxosUrl(base: string, addr: string): string {
  return `${normalizeMempoolBaseUrl(base)}/address/${encodeURIComponent(addr)}/utxo`;
}

export function addressStatsUrl(base: string, addr: string): string {
  return `${normalizeMempoolBaseUrl(base)}/address/${encodeURIComponent(addr)}`;
}

export function tipHeightUrl(base: string): string {
  return `${normalizeMempoolBaseUrl(base)}/blocks/tip/height`;
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.min(Math.max(concurrency, 1), items.length || 1);

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function fetchMempoolJsonOnce(
  url: string,
  parentSignal?: AbortSignal
): Promise<unknown> {
  const controller = new AbortController();
  const onParentAbort = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) onParentAbort();
  else parentSignal?.addEventListener("abort", onParentAbort, { once: true });

  const timer = setTimeout(() => {
    const error = new Error("mempool request timed out");
    error.name = "TimeoutError";
    controller.abort(error);
  }, MEMPOOL_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const retryAfterMs = parseRetryAfterMs(response.headers?.get?.("retry-after") ?? null);
      throw new MempoolHttpError(response.status, retryAfterMs);
    }
    return response.json();
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", onParentAbort);
  }
}

export async function fetchMempoolJson(url: string): Promise<unknown> {
  return withMempoolRetry(() => fetchMempoolJsonOnce(url));
}

export async function withMempoolRetry<T>(
  operation: () => Promise<T>,
  retryCount = MEMPOOL_RETRY_COUNT
): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= retryCount || !isRetryableMempoolError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

/** HTTP errors are not retried; timeout/network errors are. */
export function isRetryableMempoolError(error: unknown): boolean {
  if (error instanceof MempoolHttpError) return false;
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError" || error.name === "TimeoutError" || error.name === "TypeError") {
    return true;
  }
  return /timeout|network|fetch failed|ECONN|ENOTFOUND|EAI_AGAIN|ETIMEDOUT/i.test(error.message);
}

export function is429Error(error: unknown): error is MempoolHttpError {
  return error instanceof MempoolHttpError && error.status === 429;
}

export function getRateLimitRetryAfterMs(error: unknown): number | undefined {
  return is429Error(error) ? error.retryAfterMs : undefined;
}

/** Address lookups retry network/timeouts and server errors, but not 4xx/429 responses. */
export function isTransientAddressError(error: unknown): boolean {
  if (error instanceof MempoolHttpError) return error.status >= 500;
  return isRetryableMempoolError(error);
}

export const ADDRESS_RETRY_DELAY_MS = 500;

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Public API failover chain: a saved self-hosted URL (if any) is always tried first, so
 * existing self-hosted users keep their current behavior unchanged; mempool.space and
 * blockstream.info are the built-in fallback for everyone else (no node required).
 */
export type MempoolApiCandidate = { name: string; baseUrl: string };

export const PUBLIC_MEMPOOL_API_CANDIDATES: MempoolApiCandidate[] = [
  { name: "mempool.space", baseUrl: "https://mempool.space/api" },
  { name: "blockstream.info", baseUrl: "https://blockstream.info/api" },
];

export const MEMPOOL_API_DEAD_MARK_MS = 5 * 60_000;
export const MEMPOOL_RATE_LIMIT_DEFAULT_MS = 60_000;

export type MempoolApiDeadReason = "failure" | "rate-limit";

const failedUntilByBaseUrl = new Map<string, number>();
const rateLimitedUntilByBaseUrl = new Map<string, number>();

/** Marks a base URL as dead for MEMPOOL_API_DEAD_MARK_MS so the chain skips it meanwhile. */
export function markMempoolApiDead(
  baseUrl: string,
  ttlMs: number | undefined = undefined,
  reason: MempoolApiDeadReason = "failure"
): void {
  const effectiveTtlMs =
    ttlMs ?? (reason === "rate-limit" ? MEMPOOL_RATE_LIMIT_DEFAULT_MS : MEMPOOL_API_DEAD_MARK_MS);
  const deadUntil = Date.now() + effectiveTtlMs;
  const target = reason === "rate-limit" ? rateLimitedUntilByBaseUrl : failedUntilByBaseUrl;
  target.set(baseUrl, Math.max(target.get(baseUrl) ?? 0, deadUntil));
}

export function isMempoolApiDead(baseUrl: string): boolean {
  const failedUntil = failedUntilByBaseUrl.get(baseUrl) ?? 0;
  const rateLimitedUntil = rateLimitedUntilByBaseUrl.get(baseUrl) ?? 0;
  return Date.now() < Math.max(failedUntil, rateLimitedUntil);
}

/** Clears dead-marking for one URL, or every URL when called with no argument. */
export function clearMempoolApiHealth(baseUrl?: string): void {
  if (baseUrl) {
    failedUntilByBaseUrl.delete(baseUrl);
    rateLimitedUntilByBaseUrl.delete(baseUrl);
  } else {
    failedUntilByBaseUrl.clear();
    rateLimitedUntilByBaseUrl.clear();
  }
}

/** Allows manual/foreground/network-recovery syncs to retry failures without bypassing 429. */
export function clearTransientMempoolApiHealth(): void {
  failedUntilByBaseUrl.clear();
}

export function buildMempoolApiChain(customBaseUrl: string | undefined | null): MempoolApiCandidate[] {
  const trimmed = customBaseUrl?.trim();
  const chain: MempoolApiCandidate[] = [];
  if (trimmed) {
    chain.push({ name: "self-hosted", baseUrl: normalizeMempoolBaseUrl(trimmed) });
  }
  for (const candidate of PUBLIC_MEMPOOL_API_CANDIDATES) {
    if (!chain.some((c) => c.baseUrl === candidate.baseUrl)) chain.push(candidate);
  }
  return chain;
}

/**
 * Tries each candidate in chain order (skipping ones currently marked dead), stopping at the
 * first that answers a tip-height health check. Marks failing candidates dead. Returns null if
 * every candidate fails.
 */
export async function resolveHealthyMempoolApi(
  chain: MempoolApiCandidate[],
  checkTipHeight: (baseUrl: string) => Promise<number> = async (baseUrl) => {
    const raw = await fetchMempoolJson(tipHeightUrl(baseUrl));
    const height = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(height)) throw new Error("invalid tip height response");
    return height;
  }
): Promise<{ candidate: MempoolApiCandidate; height: number } | null> {
  for (const candidate of chain) {
    if (isMempoolApiDead(candidate.baseUrl)) continue;
    try {
      const height = await checkTipHeight(candidate.baseUrl);
      clearMempoolApiHealth(candidate.baseUrl);
      return { candidate, height };
    } catch (error) {
      const rateLimited = is429Error(error);
      markMempoolApiDead(
        candidate.baseUrl,
        getRateLimitRetryAfterMs(error),
        rateLimited ? "rate-limit" : "failure"
      );
    }
  }
  return null;
}
