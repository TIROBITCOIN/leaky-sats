/**
 * Watch-only xpub address derivation for mainnet.
 * Ported/simplified from Atlas packages/bitcoin (tiny-secp256k1 → @bitcoinerlab/secp256k1).
 */
import { BIP32Factory } from "bip32";
import * as bitcoin from "bitcoinjs-lib";
import bs58check from "bs58check";
import * as ecc from "@bitcoinerlab/secp256k1";
import { Buffer } from "buffer";

bitcoin.initEccLib(ecc);

const bip32 = BIP32Factory(ecc);
const NETWORK = bitcoin.networks.bitcoin;

function ensureBufferGlobal(): void {
  const globalWithBuffer = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
  if (!globalWithBuffer.Buffer) {
    globalWithBuffer.Buffer = Buffer;
  }
}

ensureBufferGlobal();

export type ExtendedPublicKeyKind = "xpub" | "ypub" | "zpub";
export type ScriptType = "legacy" | "nested-segwit" | "native-segwit";
export type AddressChain = "receive" | "change";

export type WalletDescriptor =
  | { kind: "xpub"; xpub: string; scriptType?: ScriptType }
  | { kind: "addresses"; addresses: string[] };

export type DerivedAddress = {
  chain: AddressChain;
  index: number;
  path: string;
  address: string;
};

export type DeriveAddressesInput = {
  xpub: string;
  chain: AddressChain;
  startIndex?: number;
  limit: number;
  scriptType?: ScriptType;
};

const extendedPublicKeyVersions: Record<ExtendedPublicKeyKind, Uint8Array> = {
  xpub: hexToBytes("0488b21e"),
  ypub: hexToBytes("049d7cb2"),
  zpub: hexToBytes("04b24746"),
};

const mainnetCanonicalVersion = extendedPublicKeyVersions.xpub;

export function detectExtendedPublicKeyKind(value: string): ExtendedPublicKeyKind {
  if (value.startsWith("xpub")) return "xpub";
  if (value.startsWith("ypub")) return "ypub";
  if (value.startsWith("zpub")) return "zpub";
  throw new Error("Extended public key must start with xpub, ypub, or zpub");
}

export function scriptTypeForExtendedPublicKey(type: ExtendedPublicKeyKind): ScriptType {
  if (type === "xpub") return "legacy";
  if (type === "ypub") return "nested-segwit";
  return "native-segwit";
}

export function accountDerivationPath(scriptType: ScriptType): string {
  const purpose =
    scriptType === "legacy" ? "44" : scriptType === "nested-segwit" ? "49" : "84";
  return `m/${purpose}'/0'/0'`;
}

/** Convert ypub/zpub version bytes to bip32-readable xpub version. */
export function convertToCanonicalVersion(value: string, type?: ExtendedPublicKeyKind): string {
  const kind = type ?? detectExtendedPublicKeyKind(value);
  const decoded = Uint8Array.from(bs58check.decode(value));
  if (decoded.length !== 78) {
    throw new Error("Invalid extended public key length");
  }

  const expected = extendedPublicKeyVersions[kind];
  if (!bytesEqual(decoded.subarray(0, 4), expected)) {
    throw new Error(`Extended public key version does not match ${kind}`);
  }

  const next = new Uint8Array(decoded);
  next.set(mainnetCanonicalVersion, 0);
  return bs58check.encode(next);
}

export function deriveAddresses(input: DeriveAddressesInput): DerivedAddress[] {
  const kind = detectExtendedPublicKeyKind(input.xpub);
  const scriptType = input.scriptType ?? scriptTypeForExtendedPublicKey(kind);
  const limit = sanitizeLimit(input.limit);
  const startIndex = sanitizeStartIndex(input.startIndex ?? 0);
  const accountPath = accountDerivationPath(scriptType);
  const accountNode = parseAccountExtendedPublicKey(input.xpub, kind);
  const chainIndex = input.chain === "receive" ? 0 : 1;
  const chainNode = accountNode.derive(chainIndex);

  return Array.from({ length: limit }, (_, offset) => {
    const index = startIndex + offset;
    const child = chainNode.derive(index);
    const pubkey = new Uint8Array(child.publicKey);
    return {
      chain: input.chain,
      index,
      path: `${accountPath}/${chainIndex}/${index}`,
      address: paymentAddress(pubkey, scriptType),
    };
  });
}

/** Resolve descriptor to a flat list of addresses (with optional index metadata). */
export function addressesFromDescriptor(
  descriptor: WalletDescriptor,
  options: { chain?: AddressChain; startIndex?: number; limit?: number } = {}
): DerivedAddress[] {
  if (descriptor.kind === "addresses") {
    return descriptor.addresses.map((address, index) => ({
      chain: "receive" as const,
      index,
      path: `address/${index}`,
      address,
    }));
  }

  const chain = options.chain ?? "receive";
  return deriveAddresses({
    xpub: descriptor.xpub,
    chain,
    startIndex: options.startIndex ?? 0,
    limit: options.limit ?? 20,
    scriptType: descriptor.scriptType,
  });
}

function parseAccountExtendedPublicKey(value: string, type: ExtendedPublicKeyKind) {
  try {
    ensureBufferGlobal();
    return bip32.fromBase58(convertToCanonicalVersion(value, type), NETWORK);
  } catch {
    throw new Error("Invalid extended public key");
  }
}

function paymentAddress(pubkey: Uint8Array, scriptType: ScriptType): string {
  if (scriptType === "legacy") {
    return requireAddress(bitcoin.payments.p2pkh({ pubkey, network: NETWORK }).address);
  }
  if (scriptType === "nested-segwit") {
    return requireAddress(
      bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wpkh({ pubkey, network: NETWORK }),
        network: NETWORK,
      }).address
    );
  }
  return requireAddress(bitcoin.payments.p2wpkh({ pubkey, network: NETWORK }).address);
}

function sanitizeLimit(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 200) {
    throw new Error("Address limit must be an integer from 1 to 200");
  }
  return value;
}

function sanitizeStartIndex(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 1_000_000) {
    throw new Error("Address start index must be a non-negative integer");
  }
  return value;
}

function requireAddress(value: string | undefined): string {
  if (!value) throw new Error("Unable to derive address");
  return value;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
