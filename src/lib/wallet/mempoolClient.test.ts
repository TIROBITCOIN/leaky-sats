import { describe, expect, it, vi, afterEach } from "vitest";
import {
  addressStatsUrl,
  addressUtxosUrl,
  fetchMempoolJson,
  isRetryableMempoolError,
  MempoolHttpError,
  normalizeMempoolBaseUrl,
  tipHeightUrl,
  mapWithConcurrency,
} from "./mempoolClient";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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
