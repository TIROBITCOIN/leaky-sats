import { describe, expect, it } from "vitest";
import {
  accountDerivationPath,
  convertToCanonicalVersion,
  deriveAddresses,
  detectExtendedPublicKeyKind,
  scriptTypeForExtendedPublicKey,
} from "./xpub";

/**
 * Public BIP84 (native segwit) test vector — account m/84'/0'/0'
 * Addresses: receive 0/1, change 0
 */
const ZPUB =
  "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs";
const BIP84_RECEIVE_0 = "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu";
const BIP84_RECEIVE_1 = "bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g";
const BIP84_CHANGE_0 = "bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el";

/** Public BIP49 (nested segwit) test vector — account m/49'/0'/0' (abandon…about seed) */
const YPUB =
  "ypub6Ww3ibxVfGzLrAH1PNcjyAWenMTbbAosGNB6VvmSEgytSER9azLDWCxoJwW7Ke7icmizBMXrzBx9979FfaHxHcrArf3zbeJJJUZPf663zsP";
const BIP49_RECEIVE_0 = "37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf";

/** Public BIP44 (legacy) test vector — account m/44'/0'/0' */
const XPUB =
  "xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj";
const BIP44_RECEIVE_0 = "1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA";

describe("detectExtendedPublicKeyKind", () => {
  it("detects xpub/ypub/zpub prefixes", () => {
    expect(detectExtendedPublicKeyKind(XPUB)).toBe("xpub");
    expect(detectExtendedPublicKeyKind(YPUB)).toBe("ypub");
    expect(detectExtendedPublicKeyKind(ZPUB)).toBe("zpub");
  });

  it("rejects unsupported prefixes", () => {
    expect(() => detectExtendedPublicKeyKind("tpub6...")).toThrow(/xpub, ypub, or zpub/);
    expect(() => detectExtendedPublicKeyKind("not-a-key")).toThrow();
  });
});

describe("scriptTypeForExtendedPublicKey", () => {
  it("maps prefixes to script types", () => {
    expect(scriptTypeForExtendedPublicKey("xpub")).toBe("legacy");
    expect(scriptTypeForExtendedPublicKey("ypub")).toBe("nested-segwit");
    expect(scriptTypeForExtendedPublicKey("zpub")).toBe("native-segwit");
  });
});

describe("accountDerivationPath", () => {
  it("uses BIP purpose codes on mainnet coin type 0", () => {
    expect(accountDerivationPath("legacy")).toBe("m/44'/0'/0'");
    expect(accountDerivationPath("nested-segwit")).toBe("m/49'/0'/0'");
    expect(accountDerivationPath("native-segwit")).toBe("m/84'/0'/0'");
  });
});

describe("deriveAddresses BIP84 zpub", () => {
  it("derives receive and change addresses", () => {
    const receive = deriveAddresses({ xpub: ZPUB, chain: "receive", startIndex: 0, limit: 2 });
    expect(receive.map((a) => a.address)).toEqual([BIP84_RECEIVE_0, BIP84_RECEIVE_1]);
    expect(receive[0].path).toBe("m/84'/0'/0'/0/0");

    const change = deriveAddresses({ xpub: ZPUB, chain: "change", startIndex: 0, limit: 1 });
    expect(change[0].address).toBe(BIP84_CHANGE_0);
    expect(change[0].path).toBe("m/84'/0'/0'/1/0");
  });

  it("derives native segwit when a Coldcard xpub has a BIP84 hint", () => {
    const canonicalXpub = convertToCanonicalVersion(ZPUB, "zpub");
    const receive = deriveAddresses({
      xpub: canonicalXpub,
      chain: "receive",
      startIndex: 0,
      limit: 1,
      scriptType: "native-segwit",
    });
    expect(receive[0].address).toBe(BIP84_RECEIVE_0);
  });

  it("does not require the Node Buffer global", () => {
    const globalWithBuffer = globalThis as typeof globalThis & { Buffer?: unknown };
    const hadBuffer = "Buffer" in globalWithBuffer;
    const originalBuffer = globalWithBuffer.Buffer;

    Reflect.deleteProperty(globalWithBuffer, "Buffer");
    try {
      const receive = deriveAddresses({ xpub: ZPUB, chain: "receive", startIndex: 0, limit: 1 });
      expect(receive[0].address).toBe(BIP84_RECEIVE_0);
    } finally {
      if (hadBuffer) {
        Object.defineProperty(globalWithBuffer, "Buffer", {
          configurable: true,
          writable: true,
          value: originalBuffer,
        });
      }
    }
  });
});

describe("deriveAddresses BIP49 ypub", () => {
  it("derives nested-segwit receive address", () => {
    const receive = deriveAddresses({ xpub: YPUB, chain: "receive", startIndex: 0, limit: 1 });
    expect(receive[0].address).toBe(BIP49_RECEIVE_0);
  });
});

describe("deriveAddresses BIP44 xpub", () => {
  it("derives legacy receive address", () => {
    const receive = deriveAddresses({ xpub: XPUB, chain: "receive", startIndex: 0, limit: 1 });
    expect(receive[0].address).toBe(BIP44_RECEIVE_0);
  });
});

describe("invalid keys", () => {
  it("rejects truncated / corrupted keys", () => {
    expect(() => convertToCanonicalVersion("zpub6rFR7y4Q2AijB")).toThrow();
    expect(() => deriveAddresses({ xpub: ZPUB.slice(0, 20), chain: "receive", limit: 1 })).toThrow();
  });

  it("rejects version mismatch (ypub payload claimed as zpub)", () => {
    expect(() => convertToCanonicalVersion(YPUB, "zpub")).toThrow(/version does not match/);
  });

  it("rejects invalid limit / startIndex", () => {
    expect(() => deriveAddresses({ xpub: ZPUB, chain: "receive", limit: 0 })).toThrow(/limit/);
    expect(() => deriveAddresses({ xpub: ZPUB, chain: "receive", limit: 1, startIndex: -1 })).toThrow(
      /start index/
    );
  });
});
