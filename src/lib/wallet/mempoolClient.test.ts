import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import {
  addressStatsUrl,
  addressUtxosUrl,
  buildMempoolApiChain,
  clearMempoolApiHealth,
  fetchMempoolJson,
  isMempoolApiDead,
  isRetryableMempoolError,
  isTransientAddressError,
  markMempoolApiDead,
  MEMPOOL_API_DEAD_MARK_MS,
  MempoolHttpError,
  normalizeMempoolBaseUrl,
  parseRetryAfterMs,
  PUBLIC_MEMPOOL_API_CANDIDATES,
  resolveHealthyMempoolApi,
  tipHeightUrl,
  mapWithConcurrency,
} from "./mempoolClient";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearMempoolApiHealth();
});

describe("url builders", () => {
  it("normalizes trailing slashes", () => {
    expect(normalizeMempoolBaseUrl("https://x.example/api/")).toBe("https://x.example/api");
    expect(addressUtxosUrl("https://x.example/api/", "bc1qabc")).toBe(
      "https://x.example/api/address/bc1qabc/utxo"
    );
    expect(addressStatsUrl("https://x.example/api", "bc1qabc")).toBe(
      "https://x.example/api/address/bc1qabc"
    );
    expect(tipHeightUrl("https://x.example/api///")).toBe("https://x.example/api/blocks/tip/height");
  });

  it("accepts a pasted tip-height endpoint as the base URL", () => {
    expect(normalizeMempoolBaseUrl("https://x.example/api/blocks/tip/height")).toBe(
      "https://x.example/api"
    );
    expect(tipHeightUrl("https://x.example/api/blocks/tip/height")).toBe(
      "https://x.example/api/blocks/tip/height"
    );
    expect(addressUtxosUrl("https://x.example/api/blocks/tip/height", "bc1qabc")).toBe(
      "https://x.example/api/address/bc1qabc/utxo"
    );
    expect(normalizeMempoolBaseUrl("https://x.example/api/address/bc1qabc")).toBe(
      "https://x.example/api"
    );
    expect(normalizeMempoolBaseUrl("https://x.example/api/address/bc1qabc/utxo")).toBe(
      "https://x.example/api"
    );
  });
});

describe("isRetryableMempoolError", () => {
  it("does not retry HTTP errors", () => {
    expect(isRetryableMempoolError(new MempoolHttpError(500))).toBe(false);
  });

  it("retries timeout and network TypeErrors", () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    expect(isRetryableMempoolError(abort)).toBe(true);
    expect(isRetryableMempoolError(new TypeError("fetch failed"))).toBe(true);
  });

  it("treats server errors as transient only for address-level retry", () => {
    expect(isTransientAddressError(new MempoolHttpError(503))).toBe(true);
    expect(isTransientAddressError(new MempoolHttpError(429))).toBe(false);
    expect(isTransientAddressError(new MempoolHttpError(404))).toBe(false);
  });
});

describe("Retry-After", () => {
  it("parses delta-seconds and HTTP dates", () => {
    const now = Date.parse("2026-07-14T00:00:00.000Z");
    expect(parseRetryAfterMs("120", now)).toBe(120_000);
    expect(parseRetryAfterMs("Tue, 14 Jul 2026 00:02:00 GMT", now)).toBe(120_000);
    expect(parseRetryAfterMs("invalid", now)).toBeUndefined();
  });

  it("attaches Retry-After to an HTTP 429 error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "90" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const error = await fetchMempoolJson("https://example/api/x").catch((caught) => caught);
    expect(error).toBeInstanceOf(MempoolHttpError);
    expect((error as MempoolHttpError).retryAfterMs).toBe(90_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("fetchMempoolJson", () => {
  it("retries once on network failure then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ height: 1 }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const data = await fetchMempoolJson("https://example/api/blocks/tip/height");
    expect(data).toEqual({ height: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry HTTP 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchMempoolJson("https://example/api/x")).rejects.toBeInstanceOf(MempoolHttpError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("mapWithConcurrency", () => {
  it("preserves order with limited concurrency", async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 10);
    expect(out).toEqual([10, 20, 30, 40]);
  });
});

describe("buildMempoolApiChain", () => {
  it("falls back to the public API chain when no custom URL is set", () => {
    expect(buildMempoolApiChain("")).toEqual(PUBLIC_MEMPOOL_API_CANDIDATES);
    expect(buildMempoolApiChain(undefined)).toEqual(PUBLIC_MEMPOOL_API_CANDIDATES);
    expect(buildMempoolApiChain(null)).toEqual(PUBLIC_MEMPOOL_API_CANDIDATES);
  });

  it("puts a custom self-hosted URL first, then the public APIs", () => {
    const chain = buildMempoolApiChain("https://umbrel.example/api/");
    expect(chain.map((c) => c.baseUrl)).toEqual([
      "https://umbrel.example/api",
      ...PUBLIC_MEMPOOL_API_CANDIDATES.map((c) => c.baseUrl),
    ]);
  });

  it("does not duplicate a custom URL that matches a public candidate", () => {
    const chain = buildMempoolApiChain(PUBLIC_MEMPOOL_API_CANDIDATES[0].baseUrl);
    expect(chain.map((c) => c.baseUrl)).toEqual(PUBLIC_MEMPOOL_API_CANDIDATES.map((c) => c.baseUrl));
  });
});

describe("mempool API health tracking", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks a URL dead and un-dead after MEMPOOL_API_DEAD_MARK_MS", () => {
    const url = "https://dead.example/api";
    expect(isMempoolApiDead(url)).toBe(false);
    markMempoolApiDead(url);
    expect(isMempoolApiDead(url)).toBe(true);
    vi.advanceTimersByTime(MEMPOOL_API_DEAD_MARK_MS - 1);
    expect(isMempoolApiDead(url)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isMempoolApiDead(url)).toBe(false);
  });

  it("clearMempoolApiHealth revives a URL immediately", () => {
    const url = "https://dead2.example/api";
    markMempoolApiDead(url);
    expect(isMempoolApiDead(url)).toBe(true);
    clearMempoolApiHealth(url);
    expect(isMempoolApiDead(url)).toBe(false);
  });

  it("does not shorten a longer Retry-After dead mark", () => {
    const url = "https://retry-after.example/api";
    markMempoolApiDead(url, 120_000);
    vi.advanceTimersByTime(30_000);
    markMempoolApiDead(url);
    vi.advanceTimersByTime(89_999);
    expect(isMempoolApiDead(url)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isMempoolApiDead(url)).toBe(false);
  });
});

describe("resolveHealthyMempoolApi", () => {
  it("falls back to the next candidate when the first fails", async () => {
    const chain = buildMempoolApiChain("");
    const checkTipHeight = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(900_000);

    const result = await resolveHealthyMempoolApi(chain, checkTipHeight);
    expect(result).toEqual({ candidate: chain[1], height: 900_000 });
    expect(isMempoolApiDead(chain[0].baseUrl)).toBe(true);
  });

  it("returns null when every candidate fails", async () => {
    const chain = buildMempoolApiChain("");
    const checkTipHeight = vi.fn().mockRejectedValue(new TypeError("network"));
    const result = await resolveHealthyMempoolApi(chain, checkTipHeight);
    expect(result).toBeNull();
  });
});
