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
  utxoCount: number;
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
  | { ok: true; address: string; utxos: AddressUtxo[] }
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

/** Aggregate UTXOs from per-address lookups with outpoint de-duplication. */
export function buildWalletBalance(
  lookups: AddressLookupResult[],
  options: { includeUnconfirmed?: boolean; fetchedAt?: string } = {}
): WalletBalance {
  const includeUnconfirmed = options.includeUnconfirmed ?? true;
  const outpointSeen = new Set<string>();
  const utxos: WalletUtxo[] = [];
  let failedAddresses = 0;
  let successCount = 0;

  for (const lookup of lookups) {
    if (!lookup.ok) {
      failedAddresses += 1;
      continue;
    }
    successCount += 1;
    for (const utxo of lookup.utxos) {
      if (!includeUnconfirmed && !utxo.confirmed) continue;
      const outpoint = `${utxo.txid}:${utxo.vout}`;
      if (outpointSeen.has(outpoint)) continue;
      outpointSeen.add(outpoint);
      utxos.push({ ...utxo, outpoint, address: lookup.address });
    }
  }

  const confirmedSats = utxos.filter((u) => u.confirmed).reduce((s, u) => s + u.valueSats, 0);
  const unconfirmedSats = utxos.filter((u) => !u.confirmed).reduce((s, u) => s + u.valueSats, 0);

  const status: WalletBalanceStatus =
    failedAddresses === 0 ? "online" : successCount === 0 ? "offline" : "partial";

  return {
    confirmedSats,
    unconfirmedSats,
    totalSats: confirmedSats + unconfirmedSats,
    utxoCount: utxos.length,
    status,
    failedAddresses,
    fetchedAt: options.fetchedAt ?? new Date().toISOString(),
  };
}
