/**
 * UTXO parse + wallet balance summary.
 * Ported from Atlas apps/api/src/mempool/utxos.ts (buildSummary + outpoint dedupe).
 */

export type AddressUtxo = {
  txid: string;
  vout: number;
  valueSats: number;
  confirmed: boolean;
};

export type WalletUtxo = AddressUtxo & {
  outpoint: string;
  address: string;
};

export type WalletBalanceStatus = "online" | "partial" | "offline";

export type WalletBalance = {
  confirmedSats: number;
  unconfirmedSats: number;
  totalSats: number;
  utxoCount: number | undefined;
  status: WalletBalanceStatus;
  failedAddresses: number;
  fetchedAt: string;
  scannedAddressCount?: number;
  receiveLastUsed?: number;
  changeLastUsed?: number;
  stoppedReason?: string;
  scriptType?: string;
};

export type AddressLookupResult =
  | {
      ok: true;
      address: string;
      confirmedSats: number;
      unconfirmedSats: number;
      /** Filled only when an /utxo lookup succeeded (esplora backend); null on electrum backends. */
      utxos: AddressUtxo[] | null;
    }
  | { ok: false; address: string; error: string };

export function parseAddressUtxo(raw: unknown): AddressUtxo | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const txid = typeof r.txid === "string" ? r.txid : null;
  const vout = typeof r.vout === "number" ? r.vout : null;
  const value = typeof r.value === "number" ? r.value : null;
  if (!txid || vout === null || value === null) return null;

  const rawStatus =
    typeof r.status === "object" && r.status !== null
      ? (r.status as Record<string, unknown>)
      : {};
  const confirmed = rawStatus.confirmed === true;

  return { txid, vout, valueSats: value, confirmed };
}

export function parseAddressUtxoArray(raw: unknown): AddressUtxo[] | null {
  if (!Array.isArray(raw)) return null;
  const result: AddressUtxo[] = [];
  for (const item of raw) {
    const parsed = parseAddressUtxo(item);
    if (parsed) result.push(parsed);
  }
  return result;
}

/**
 * Aggregate per-address lookup results into a wallet balance.
 * Sats are summed directly from each address's stats (not from utxo arrays), so this
 * works whether the backend is esplora (utxo arrays present) or electrum (utxos: null).
 * utxoCount is only computed when every successful lookup carries a utxo array.
 */
export function buildWalletBalance(
  lookups: AddressLookupResult[],
  options: { includeUnconfirmed?: boolean; fetchedAt?: string } = {}
): WalletBalance {
  const includeUnconfirmed = options.includeUnconfirmed ?? true;
  const outpointSeen = new Set<string>();
  let failedAddresses = 0;
  let successCount = 0;
  let confirmedSats = 0;
  let unconfirmedSats = 0;
  let allHaveUtxos = true;

  for (const lookup of lookups) {
    if (!lookup.ok) {
      failedAddresses += 1;
      continue;
    }
    successCount += 1;
    confirmedSats += lookup.confirmedSats;
    unconfirmedSats += lookup.unconfirmedSats;

    if (lookup.utxos === null) {
      allHaveUtxos = false;
      continue;
    }
    for (const utxo of lookup.utxos) {
      if (!includeUnconfirmed && !utxo.confirmed) continue;
      const outpoint = `${utxo.txid}:${utxo.vout}`;
      outpointSeen.add(outpoint);
    }
  }

  const totalSats = confirmedSats + (includeUnconfirmed ? unconfirmedSats : 0);
  const status: WalletBalanceStatus =
    failedAddresses === 0 ? "online" : successCount === 0 ? "offline" : "partial";

  return {
    confirmedSats,
    unconfirmedSats,
    totalSats,
    utxoCount: allHaveUtxos ? outpointSeen.size : undefined,
    status,
    failedAddresses,
    fetchedAt: options.fetchedAt ?? new Date().toISOString(),
  };
}
