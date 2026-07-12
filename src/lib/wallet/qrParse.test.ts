import { describe, expect, it } from "vitest";
import {
  extractBitcoinAddresses,
  extractExtendedPublicKey,
  parseExtendedPublicKeyText,
  parseWatchOnlyQrText,
} from "./qrParse";

// Valid-shaped base58 keys (length/charset only — not real wallets)
const ZPUB =
  "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs";
const XPUB =
  "xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWKiKrhko4egpiMZbpiaQL2jkwSB1icqYh2cfDfVxdx4df189oLKnC5fSwqPfgyP3hooxujYzAu3fDVmz";

describe("extractExtendedPublicKey", () => {
  it("reads plain zpub", () => {
    expect(extractExtendedPublicKey(ZPUB)).toBe(ZPUB);
  });

  it("reads path-prefixed Specter/Sparrow style", () => {
    expect(extractExtendedPublicKey(`[84'/0'/0']${ZPUB}`)).toBe(ZPUB);
    expect(extractExtendedPublicKey(`[84h/0h/0h]${ZPUB}`)).toBe(ZPUB);
  });

  it("keeps Coldcard path hints for plain xpub exports", () => {
    expect(parseExtendedPublicKeyText(`[84h/0h/0h]${XPUB}`)).toEqual({
      xpub: XPUB,
      scriptType: "native-segwit",
    });
    expect(parseExtendedPublicKeyText(`[49'/0'/0']${XPUB}`)?.scriptType).toBe("nested-segwit");
  });

  it("reads JSON export with xpub field", () => {
    const json = JSON.stringify({ xfp: "aabbccdd", account: "m/84'/0'/0'", xpub: ZPUB });
    expect(extractExtendedPublicKey(json)).toBe(ZPUB);
    expect(parseExtendedPublicKeyText(json)?.scriptType).toBe("native-segwit");
  });

  it("reads xpub in surrounding prose", () => {
    expect(extractExtendedPublicKey(`Account key:\n${XPUB}\n`)).toBe(XPUB);
  });

  it("returns null for garbage", () => {
    expect(extractExtendedPublicKey("hello world")).toBeNull();
  });
});

describe("extractBitcoinAddresses", () => {
  it("finds bech32 and legacy", () => {
    const text = "send to bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4 and 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";
    const addrs = extractBitcoinAddresses(text);
    expect(addrs).toContain("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4");
    expect(addrs).toContain("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa");
  });
});

describe("parseWatchOnlyQrText", () => {
  it("prefers xpub over addresses", () => {
    const r = parseWatchOnlyQrText(`${ZPUB}\nbc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.kind).toBe("xpub");
      if (r.payload.kind === "xpub") expect(r.payload.xpub).toBe(ZPUB);
    }
  });

  it("returns script type for path-prefixed xpub QR payloads", () => {
    const r = parseWatchOnlyQrText(`[84h/0h/0h]${XPUB}`);
    expect(r.ok).toBe(true);
    if (r.ok && r.payload.kind === "xpub") {
      expect(r.payload.scriptType).toBe("native-segwit");
    }
  });

  it("falls back to addresses", () => {
    const r = parseWatchOnlyQrText("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.kind).toBe("addresses");
      if (r.payload.kind === "addresses") {
        expect(r.payload.addresses).toEqual(["bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"]);
      }
    }
  });

  it("rejects empty and UR formats", () => {
    expect(parseWatchOnlyQrText("").ok).toBe(false);
    expect(parseWatchOnlyQrText("ur:crypto-account/1-2/lpad...").ok).toBe(false);
  });
});
