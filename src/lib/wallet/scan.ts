/**
 * Gap-limit wallet scan over mempool/esplora APIs.
 */
import {
  type AddressLookupResult,
  type AddressUtxo,
  buildWalletBalance,
  parseAddressUtxoArray,
  type WalletBalance,
} from "./balance";
import {
  addressStatsUrl,
  addressUtxosUrl,
  fetchMempoolJson,
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
  stoppedReason: "gap" | "hardCap";
};

export type ScanWalletResult = {
  balance: WalletBalance;
  chains: ScanChainResult[];
  /** Flat unique address list that was queried */
  scannedAddresses: DerivedAddress[];
};

type AddressActivity = {
  used: boolean;
  utxos: AddressUtxo[] | null;
  failed: boolean;
  error?: string;
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

export async function lookupAddressActivity(
  baseUrl: string,
  address: string,
  fetchJson: (url: string) => Promise<unknown> = fetchMempoolJson
): Promise<AddressActivity> {
  try {
    const utxoRaw = await fetchJson(addressUtxosUrl(baseUrl, address));
    const utxos = parseAddressUtxoArray(utxoRaw);
    if (utxos === null) {
      return { used: false, utxos: null, failed: true, error: "invalid utxo payload" };
    }
    if (utxos.length > 0) {
      return { used: true, utxos, failed: false };
    }

    // Balance 0 but history may still reset the gap.
    const statsRaw = await fetchJson(addressStatsUrl(baseUrl, address));
    const used = addressHasHistory(statsRaw);
    return { used, utxos, failed: false };
  } catch (error) {
    return {
      used: false,
      utxos: null,
      failed: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function addressHasHistory(statsRaw: unknown): boolean {
  if (typeof statsRaw !== "object" || statsRaw === null) return false;
  const r = statsRaw as Record<string, unknown>;
  const chain =
    typeof r.chain_stats === "object" && r.chain_stats !== null
      ? (r.chain_stats as Record<string, unknown>)
      : {};
  const mempool =
    typeof r.mempool_stats === "object" && r.mempool_stats !== null
      ? (r.mempool_stats as Record<string, unknown>)
      : {};
  const chainTx = typeof chain.tx_count === "number" ? chain.tx_count : 0;
  const memTx = typeof mempool.tx_count === "number" ? mempool.tx_count : 0;
  return chainTx + memTx > 0;
}

async function scanXpubChain(
  xpub: string,
  chain: AddressChain,
  baseUrl: string,
  options: Required<Pick<ScanOptions, "gapLimit" | "hardCap" | "batchSize" | "concurrency">> & {
    fetchJson: (url: string) => Promise<unknown>;
    scriptType?: import("./xpub").ScriptType;
  }
): Promise<{ chainResult: ScanChainResult; lookups: AddressLookupResult[] }> {
  const addresses: DerivedAddress[] = [];
  const lookups: AddressLookupResult[] = [];
  let startIndex = 0;
  let lastUsedIndex = -1;
  let consecutiveUnused = 0;
  let stoppedReason: "gap" | "hardCap" = "gap";

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
      const activity = await lookupAddressActivity(baseUrl, item.address, options.fetchJson);
      if (activity.failed) {
        return { ok: false as const, address: item.address, error: activity.error ?? "lookup failed", used: false, index: item.index };
      }
      return {
        ok: true as const,
        address: item.address,
        utxos: activity.utxos ?? [],
        used: activity.used,
        index: item.index,
      };
    });

    for (const row of batchLookups) {
      if (!row.ok) {
        lookups.push({ ok: false, address: row.address, error: row.error });
        // Treat failed lookup as unused for gap counting (conservative for discovery;
        // balance layer marks partial separately).
        consecutiveUnused += 1;
      } else {
        lookups.push({ ok: true, address: row.address, utxos: row.utxos });
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
  };
}

export async function scanWallet(
  descriptor: WalletDescriptor,
  baseUrl: string,
  options: ScanOptions = {}
): Promise<ScanWalletResult> {
  const gapLimit = sanitizeGapLimit(options.gapLimit ?? 20);
  const hardCap = sanitizeHardCap(options.hardCap ?? 200);
  const batchSize = options.batchSize ?? gapLimit;
  const concurrency = options.concurrency ?? MEMPOOL_LOOKUP_CONCURRENCY;
  const fetchJson = options.fetchJson ?? fetchMempoolJson;
  const includeUnconfirmed = options.includeUnconfirmed ?? true;

  if (descriptor.kind === "addresses") {
    const scannedAddresses = descriptor.addresses.map((address, index) => ({
      chain: "receive" as const,
      index,
      path: `address/${index}`,
      address,
    }));

    const lookups = await mapWithConcurrency(scannedAddresses, concurrency, async (item) => {
      const activity = await lookupAddressActivity(baseUrl, item.address, fetchJson);
      if (activity.failed || activity.utxos === null) {
        return { ok: false as const, address: item.address, error: activity.error ?? "lookup failed" };
      }
      return { ok: true as const, address: item.address, utxos: activity.utxos };
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
  };
}
