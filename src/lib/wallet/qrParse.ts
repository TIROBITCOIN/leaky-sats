/**
 * Extract watch-only xpub/ypub/zpub or Bitcoin addresses from QR payload text.
 * Hardware wallets / Sparrow / Electrum often encode plain keys, path-prefixed keys, or JSON.
 */
import type { ScriptType } from "./xpub";

export type QrWatchPayload =
  | { kind: "xpub"; xpub: string; scriptType?: ScriptType }
  | { kind: "addresses"; addresses: string[] };

export type QrParseResult =
  | { ok: true; payload: QrWatchPayload }
  | { ok: false; error: string };

/** Base58 extended public key (xpub / ypub / zpub). Typical length ~111. */
const EXTENDED_KEY_RE = /\b([xyz]pub[1-9A-HJ-NP-Za-km-z]{80,130})\b/i;

/** Mainnet bech32 / legacy / p2sh-ish address shapes (loose; chain validation is separate). */
const ADDRESS_RE =
  /\b((?:bc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{25,90})|(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}))\b/g;

function scriptTypeFromText(text: string): ScriptType | undefined {
  const normalized = text.replace(/[hH]/g, "'").replace(/m\//gi, "");
  const match = normalized.match(/(?:^|[^0-9])(44|49|84)'?\s*\/\s*0'?\s*\/\s*0'?/);
  if (!match?.[1]) return undefined;
  if (match[1] === "84") return "native-segwit";
  if (match[1] === "49") return "nested-segwit";
  return "legacy";
}

function tryJsonXpub(text: string): { xpub: string; scriptType?: ScriptType } | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    const data = JSON.parse(trimmed) as unknown;
    const candidates: unknown[] = [];
    const pathHints: string[] = [];
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const obj = data as Record<string, unknown>;
      candidates.push(obj.xpub, obj.ypub, obj.zpub, obj.ExtPubKey, obj.extPubKey, obj.publicKey);
      for (const key of ["account", "derivation", "path", "bip32Path", "origin"] as const) {
        if (typeof obj[key] === "string") pathHints.push(obj[key]);
      }
      if (obj.descriptor && typeof obj.descriptor === "string") {
        candidates.push(obj.descriptor);
        pathHints.push(obj.descriptor);
      }
    }
    for (const c of candidates) {
      if (typeof c === "string") {
        const found = c.match(EXTENDED_KEY_RE);
        if (found?.[1]) {
          return { xpub: found[1], scriptType: scriptTypeFromText([c, ...pathHints].join(" ")) };
        }
      }
    }
  } catch {
    /* not JSON */
  }
  return null;
}

/** Strip common BIP32 path / origin prefixes: [84'/0'/0']zpub… or [84h/0h/0h]zpub… */
function stripOriginPrefix(text: string): string {
  return text.replace(/\[[^\]]+\]/g, " ");
}

export function extractExtendedPublicKey(text: string): string | null {
  return parseExtendedPublicKeyText(text)?.xpub ?? null;
}

export function parseExtendedPublicKeyText(text: string): { xpub: string; scriptType?: ScriptType } | null {
  if (!text || typeof text !== "string") return null;

  const fromJson = tryJsonXpub(text);
  if (fromJson) return fromJson;

  const scriptType = scriptTypeFromText(text);
  const normalized = stripOriginPrefix(text).replace(/\s+/g, " ").trim();
  const match = normalized.match(EXTENDED_KEY_RE);
  if (match?.[1]) return { xpub: match[1], scriptType };

  // Whole string is the key (no word boundaries needed)
  const compact = text.trim().replace(/\s+/g, "");
  const whole = compact.match(/^([xyz]pub[1-9A-HJ-NP-Za-km-z]{80,130})$/i);
  if (whole?.[1]) return { xpub: whole[1], scriptType };

  return null;
}

export function extractBitcoinAddresses(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  const found = new Set<string>();
  const re = new RegExp(ADDRESS_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const addr = m[1];
    if (addr && !/^([xyz]pub)/i.test(addr)) {
      found.add(addr);
    }
  }
  return [...found];
}

/**
 * Prefer extended public key; fall back to one or more addresses.
 */
export function parseWatchOnlyQrText(raw: string): QrParseResult {
  const text = (raw ?? "").trim();
  if (!text) {
    return { ok: false, error: "빈 QR 코드입니다." };
  }

  // UR / animated / multi-part formats are not supported yet
  if (/^ur:/i.test(text) || /^UR:/i.test(text)) {
    return {
      ok: false,
      error: "UR(Uniform Resource) QR은 아직 지원하지 않습니다. xpub 문자열 QR을 사용하세요.",
    };
  }

  const parsedXpub = parseExtendedPublicKeyText(text);
  if (parsedXpub) {
    return { ok: true, payload: { kind: "xpub", ...parsedXpub } };
  }

  const addresses = extractBitcoinAddresses(text);
  if (addresses.length > 0) {
    return { ok: true, payload: { kind: "addresses", addresses } };
  }

  return {
    ok: false,
    error: "QR에서 xpub/ypub/zpub 또는 비트코인 주소를 찾지 못했습니다.",
  };
}
