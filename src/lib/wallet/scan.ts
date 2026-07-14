/**
 * Gap-limit wallet scan over mempool/esplora APIs.
 */
import {
  type AddressLookupResult,
  type AddressUtxo,
  buildWalletBalance,
  type WalletBalance,
} from "./balance";
import {
  ADDRESS_RETRY_DELAY_MS,
  addressStatsUrl,
  delay,
  fetchMempoolJsonOnce,
  getRateLimitRetryAfterMs,
  is429Error,
  isTransientAddressError,
  mapWithConcurrency,
  MEMPOOL_LOOKUP_CONCURRENCY,
} from "./mempoolClient";
import {
  type AddressChain,
  type DerivedAddress,
  deriveAddresses,
  type WalletDescriptor,
} from "./xpub";

export type ScanOptions = {
  gapLimit?: number;
  hardCap?: number;
  batchSize?: number;
  concurrency?: number;
  includeUnconfirmed?: boolean;
  /** Injected for tests */
  fetchJson?: (url: string) => Promise<unknown>;
};

export type ScanChainResult = {
  chain: AddressChain;
  addresses: DerivedAddress[];
  lastUsedIndex: number; // -1 if none used
  stoppedReason: "gap" | "hardCap" | "rateLimit";
};

export type ScanWalletResult = {
  balance: WalletBalance;
  chains: ScanChainResult[];
  /** Flat unique address list that was queried */
  scannedAddresses: DerivedAddress[];
  rateLimited: boolean;
  rateLimitRetryAfterMs?: number;
};

type AddressActivity = {
  used: boolean;
  confirmedSats: number;
  unconfirmedSats: number;
  utxos: AddressUtxo[] | null;
  failed: boolean;
  error?: string;
  rateLimited?: boolean;
  rateLimitRetryAfterMs?: number;
};

export type AddressStatsSummary = {
  confirmedSats: number;
  unconfirmedSats: number;
  used: boolean;
};

function sanitizeGapLimit(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 200) {
    throw new Error("gapLimit must be an integer from 1 to 200");
  }
  return value;
}

function sanitizeHardCap(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 2000) {
    throw new Error("hardCap must be a positive integer");
  }
  return value;
}

/**
 * Looks up an address's activity via the /address/{addr} stats endpoint.
 * Stats work on both esplora and electrum (romanz/electrs) mempool backends, unlike
 * /address/{addr}/utxo which electrum backends don't implement (404). We therefore never
 * call /utxo during a scan; utxoCount is simply left undefined for such backends.
 */
async function lookupAddressActivityOnce(
  baseUrl: string,
  address: string,
  fetchJson: (url: string) => Promise<unknown> = fetchMempoolJsonOnce
): Promise<AddressActivity> {
  const statsRaw = await fetchJson(addressStatsUrl(baseUrl, address));
  const summary = parseAddressStats(statsRaw);
  if (summary === null) {
    return {
      used: false,
      confirmedSats: 0,
      unconfirmedSats: 0,
      utxos: null,
      failed: true,
      error: "invalid stats payload",
    };
  }
  return {
    used: summary.used,
    confirmedSats: summary.confirmedSats,
    unconfirmedSats: summary.unconfirmedSats,
    utxos: null,
    failed: false,
  };
}

function failedAddressActivity(error: unknown): AddressActivity {
  return {
    used: false,
    confirmedSats: 0,
    unconfirmedSats: 0,
    utxos: null,
    failed: true,
    rateLimited: is429Error(error),
    rateLimitRetryAfterMs: getRateLimitRetryAfterMs(error),
    error: error instanceof Error ? error.message : String(error),
  };
}

function cancelledAddressActivity(): AddressActivity {
  return {
    used: false,
    confirmedSats: 0,
    unconfirmedSats: 0,
    utxos: null,
    failed: true,
    error: "rate limited",
  };
}

export async function lookupAddressActivity(
  baseUrl: string,
  address: string,
  fetchJson: (url: string) => Promise<unknown> = fetchMempoolJsonOnce,
  shouldCancel: () => boolean = () => false
): Promise<AddressActivity> {
  try {
    return await lookupAddressActivityOnce(baseUrl, address, fetchJson);
  } catch (error) {
    // Preserve every 429 (and its Retry-After), even when another concurrent worker
    // already raised the shared cancellation flag. Cancellation only suppresses retries.
    if (is429Error(error)) return failedAddressActivity(error);
    if (shouldCancel()) return cancelledAddressActivity();
    if (!isTransientAddressError(error)) return failedAddressActivity(error);
    await delay(ADDRESS_RETRY_DELAY_MS);
    if (shouldCancel()) return cancelledAddressActivity();
    try {
      return await lookupAddressActivityOnce(baseUrl, address, fetchJson);
    } catch (retryError) {
      return failedAddressActivity(retryError);
    }
  }
}

export function parseAddressStats(statsRaw: unknown): AddressStatsSummary | null {
  if (typeof statsRaw !== "object" || statsRaw === null) return null;
  const r = statsRaw as Record<string, unknown>;
  const chain =
    typeof r.chain_stats === "object" && r.chain_stats !== null
      ? (r.chain_stats as Record<string, unknown>)
      : null;
  const mempool =
    typeof r.mempool_stats === "object" && r.mempool_stats !== null
      ? (r.mempool_stats as Record<string, unknown>)
      : null;
  if (!chain && !mempool) return null;

  const num = (obj: Record<string, unknown> | null, key: string) =>
    obj && typeof obj[key] === "number" ? (obj[key] as number) : 0;

  const chainTx = num(chain, "tx_count");
  const memTx = num(mempool, "tx_count");
  const confirmedSats = Math.max(0, num(chain, "funded_txo_sum") - num(chain, "spent_txo_sum"));
  const unconfirmedSats = Math.max(0, num(mempool, "funded_txo_sum") - num(mempool, "spent_txo_sum"));

  return {
    confirmedSats,
    unconfirmedSats,
    used: chainTx + memTx > 0,
  };
}

async function scanXpubChain(
  xpub: string,
  chain: AddressChain,
  baseUrl: string,
  options: Required<Pick<ScanOptions, "gapLimit" | "hardCap" | "batchSize" | "concurrency">> & {
    fetchJson: (url: string) => Promise<unknown>;
    scriptType?: import("./xpub").ScriptType;
  }
): Promise<{
  chainResult: ScanChainResult;
  lookups: AddressLookupResult[];
  rateLimited: boolean;
  rateLimitRetryAfterMs?: number;
}> {
  const addresses: DerivedAddress[] = [];
  const lookups: AddressLookupResult[] = [];
  let startIndex = 0;
  let lastUsedIndex = -1;
  let consecutiveUnused = 0;
  let stoppedReason: "gap" | "hardCap" = "gap";
  let rateLimited = false;
  let rateLimitRetryAfterMs: number | undefined;

  while (startIndex < options.hardCap) {
    const remaining = options.hardCap - startIndex;
    const limit = Math.min(options.batchSize, remaining);
    if (limit <= 0) break;

    const batch = deriveAddresses({
      xpub,
      chain,
      startIndex,
      limit,
      scriptType: options.scriptType,
    });
    addresses.push(...batch);

    const batchLookups = await mapWithConcurrency(batch, options.concurrency, async (item) => {
      if (rateLimited) {
        return {
          ok: false as const,
          address: item.address,
          error: "rate limited",
          used: false,
          index: item.index,
        };
      }
      const activity = await lookupAddressActivity(
        baseUrl,
        item.address,
        options.fetchJson,
        () => rateLimited
      );
      if (activity.rateLimited) {
        rateLimited = true;
        if (activity.rateLimitRetryAfterMs !== undefined) {
          rateLimitRetryAfterMs = Math.max(rateLimitRetryAfterMs ?? 0, activity.rateLimitRetryAfterMs);
        }
      }
      if (activity.failed) {
        return {
          ok: false as const,
          address: item.address,
          error: activity.error ?? "lookup failed",
          used: false,
          index: item.index,
        };
      }
      return {
        ok: true as const,
        address: item.address,
        confirmedSats: activity.confirmedSats,
        unconfirmedSats: activity.unconfirmedSats,
        utxos: activity.utxos,
        used: activity.used,
        index: item.index,
      };
    });

    if (rateLimited) {
      for (const row of batchLookups) {
        if (!row.ok) {
          lookups.push({ ok: false, address: row.address, error: row.error });
        } else {
          lookups.push({
            ok: true,
            address: row.address,
            confirmedSats: row.confirmedSats,
            unconfirmedSats: row.unconfirmedSats,
            utxos: row.utxos,
          });
        }
      }
      return {
        chainResult: { chain, addresses, lastUsedIndex, stoppedReason: "rateLimit" },
        lookups,
        rateLimited: true,
        rateLimitRetryAfterMs,
      };
    }

    for (const row of batchLookups) {
      if (!row.ok) {
        lookups.push({ ok: false, address: row.address, error: row.error });
        // Treat failed lookup as unused for gap counting (conservative for discovery;
        // balance layer marks partial separately).
        consecutiveUnused += 1;
      } else {
        lookups.push({
          ok: true,
          address: row.address,
          confirmedSats: row.confirmedSats,
          unconfirmedSats: row.unconfirmedSats,
          utxos: row.utxos,
        });
        if (row.used) {
          lastUsedIndex = row.index;
          consecutiveUnused = 0;
        } else {
          consecutiveUnused += 1;
        }
      }

      if (consecutiveUnused >= options.gapLimit) {
        return {
          chainResult: { chain, addresses, lastUsedIndex, stoppedReason: "gap" },
          lookups,
          rateLimited,
          rateLimitRetryAfterMs,
        };
      }
    }

    startIndex += limit;
    if (startIndex >= options.hardCap) {
      stoppedReason = "hardCap";
      break;
    }
  }

  return {
    chainResult: { chain, addresses, lastUsedIndex, stoppedReason },
    lookups,
    rateLimited,
    rateLimitRetryAfterMs,
  };
}

export async function scanWallet(
  descriptor: WalletDescriptor,
  baseUrl: string,
  options: ScanOptions = {}
): Promise<ScanWalletResult> {
  const gapLimit = sanitizeGapLimit(options.gapLimit ?? 200);
  const hardCap = sanitizeHardCap(options.hardCap ?? 200);
  const batchSize = options.batchSize ?? gapLimit;
  const concurrency = options.concurrency ?? MEMPOOL_LOOKUP_CONCURRENCY;
  const fetchJson = options.fetchJson ?? fetchMempoolJsonOnce;
  const includeUnconfirmed = options.includeUnconfirmed ?? true;

  if (descriptor.kind === "addresses") {
    const scannedAddresses = descriptor.addresses.map((address, index) => ({
      chain: "receive" as const,
      index,
      path: `address/${index}`,
      address,
    }));

    let addrRateLimited = false;
    let rateLimitRetryAfterMs: number | undefined;
    const lookups = await mapWithConcurrency(scannedAddresses, concurrency, async (item) => {
      if (addrRateLimited) {
        return { ok: false as const, address: item.address, error: "rate limited" };
      }
      const activity = await lookupAddressActivity(
        baseUrl,
        item.address,
        fetchJson,
        () => addrRateLimited
      );
      if (activity.rateLimited) {
        addrRateLimited = true;
        if (activity.rateLimitRetryAfterMs !== undefined) {
          rateLimitRetryAfterMs = Math.max(rateLimitRetryAfterMs ?? 0, activity.rateLimitRetryAfterMs);
        }
      }
      if (activity.failed) {
        return { ok: false as const, address: item.address, error: activity.error ?? "lookup failed" };
      }
      return {
        ok: true as const,
        address: item.address,
        confirmedSats: activity.confirmedSats,
        unconfirmedSats: activity.unconfirmedSats,
        utxos: activity.utxos,
      };
    });

    return {
      balance: buildWalletBalance(lookups, { includeUnconfirmed }),
      chains: [
        {
          chain: "receive",
          addresses: scannedAddresses,
          lastUsedIndex: scannedAddresses.length > 0 ? scannedAddresses.length - 1 : -1,
          stoppedReason: "gap",
        },
      ],
      scannedAddresses,
      rateLimited: addrRateLimited,
      rateLimitRetryAfterMs,
    };
  }

  const chainOpts = {
    gapLimit,
    hardCap,
    batchSize,
    concurrency,
    fetchJson,
    scriptType: descriptor.scriptType,
  };

  const receive = await scanXpubChain(descriptor.xpub, "receive", baseUrl, chainOpts);
  if (receive.rateLimited) {
    return {
      balance: buildWalletBalance(receive.lookups, { includeUnconfirmed }),
      chains: [
        receive.chainResult,
        { chain: "change", addresses: [], lastUsedIndex: -1, stoppedReason: "rateLimit" },
      ],
      scannedAddresses: receive.chainResult.addresses,
      rateLimited: true,
      rateLimitRetryAfterMs: receive.rateLimitRetryAfterMs,
    };
  }
  const change = await scanXpubChain(descriptor.xpub, "change", baseUrl, chainOpts);

  const allLookups = [...receive.lookups, ...change.lookups];
  const scannedAddresses = [...receive.chainResult.addresses, ...change.chainResult.addresses];

  // If any chain hit hardCap, force partial-ish signal via a synthetic failure only when
  // hardCap stopped and we might have more history — balance status still from lookups.
  let balance = buildWalletBalance(allLookups, { includeUnconfirmed });
  if (
    (receive.chainResult.stoppedReason === "hardCap" || change.chainResult.stoppedReason === "hardCap") &&
    balance.status === "online"
  ) {
    // Mark as partial when discovery was truncated (incomplete address set).
    balance = { ...balance, status: "partial" };
  }

  return {
    balance,
    chains: [receive.chainResult, change.chainResult],
    scannedAddresses,
    rateLimited: receive.rateLimited || change.rateLimited,
    rateLimitRetryAfterMs: change.rateLimitRetryAfterMs,
  };
}
