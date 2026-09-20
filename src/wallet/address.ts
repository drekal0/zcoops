import { createHash } from "crypto";
import type { Network } from "./adapter";

/**
 * Real Zcash address validation — checksum + network match, no dependencies.
 *
 * Covers the encodings a claimant can paste:
 *   - transparent  t1/t3 (mainnet), tm/t2 (testnet & regtest)   → Base58Check
 *   - sapling      zs (mainnet), ztestsapling / zregtestsapling → Bech32
 *   - unified (UA) u (mainnet), utest / uregtest                → Bech32m
 *
 * It verifies the checksum (catches typos) and the network prefix (catches
 * mainnet-address-in-a-testnet-pool). It does NOT fully decode UA receivers
 * (ZIP-316 F4Jumble) — a well-formed-but-unspendable UA would fail cleanly at
 * the wallet on send. That's the pragmatic line: reject the mistakes people
 * actually make, don't reimplement the wallet.
 */

export type AddressType = "transparent" | "sapling" | "unified";
export type AddressCheck =
  | { ok: true; type: AddressType; network: Network | "test" }
  | { ok: false; reason: string };

export function validateZcashAddress(addressRaw: string, poolNetwork: Network): AddressCheck {
  const address = addressRaw.trim();
  if (!address) return { ok: false, reason: "Address is empty." };
  if (address !== address.toLowerCase() && address.startsWith("u"))
    return { ok: false, reason: "That doesn't look like a valid Zcash address." };

  const parsed = classify(address);
  if (!parsed) return { ok: false, reason: "That doesn't look like a valid Zcash address." };
  if (!parsed.ok) return parsed;

  if (!networkAccepted(parsed.network, poolNetwork)) {
    return { ok: false, reason: `That's a ${labelNet(parsed.network)} address, but this pool is on ${poolNetwork}.` };
  }
  return { ok: true, type: parsed.type, network: parsed.network };
}

// --- classification -------------------------------------------------------

type Classified =
  | { ok: true; type: AddressType; network: Network | "test" }
  | { ok: false; reason: string };

function classify(a: string): Classified | null {
  // Unified (bech32m): u1 / utest1 / uregtest1
  if (/^u(test|regtest)?1/.test(a)) {
    const dec = decodeBech32(a);
    if (!dec || dec.enc !== "bech32m") return { ok: false, reason: "Invalid unified address (checksum failed)." };
    const net = uaNet(dec.hrp);
    if (!net) return { ok: false, reason: "Unrecognized unified address prefix." };
    return { ok: true, type: "unified", network: net };
  }
  // Sapling (bech32): zs1 / ztestsapling1 / zregtestsapling1
  if (/^z(s|testsapling|regtestsapling)1/.test(a)) {
    const dec = decodeBech32(a);
    if (!dec || dec.enc !== "bech32") return { ok: false, reason: "Invalid shielded address (checksum failed)." };
    const net = saplingNet(dec.hrp);
    if (!net) return { ok: false, reason: "Unrecognized shielded address prefix." };
    return { ok: true, type: "sapling", network: net };
  }
  // Transparent (Base58Check): t1/t3/tm/t2
  if (/^t[0-9a-zA-Z]/.test(a)) {
    const payload = b58checkDecode(a);
    if (!payload) return { ok: false, reason: "Invalid transparent address (checksum failed)." };
    const net = transparentNet(payload);
    if (!net) return { ok: false, reason: "Unrecognized transparent address version." };
    return { ok: true, type: "transparent", network: net };
  }
  return null;
}

function uaNet(hrp: string): Network | null {
  if (hrp === "u") return "mainnet";
  if (hrp === "utest") return "testnet";
  if (hrp === "uregtest") return "regtest";
  return null;
}
function saplingNet(hrp: string): Network | null {
  if (hrp === "zs") return "mainnet";
  if (hrp === "ztestsapling") return "testnet";
  if (hrp === "zregtestsapling") return "regtest";
  return null;
}
// Transparent version prefixes are 2 bytes; testnet & regtest share them → "test".
function transparentNet(payload: Uint8Array): Network | "test" | null {
  if (payload.length !== 22) return null; // 2 version + 20 hash
  const v = (payload[0] << 8) | payload[1];
  if (v === 0x1cb8 || v === 0x1cbd) return "mainnet";        // t1 P2PKH / t3 P2SH
  if (v === 0x1d25 || v === 0x1cba) return "test";           // tm P2PKH / t2 P2SH
  return null;
}

function networkAccepted(addrNet: Network | "test", poolNet: Network): boolean {
  if (addrNet === "test") return poolNet === "testnet" || poolNet === "regtest";
  return addrNet === poolNet;
}
function labelNet(n: Network | "test"): string {
  return n === "test" ? "testnet/regtest" : n;
}

// --- Bech32 / Bech32m ------------------------------------------------------

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values: number[]): number {
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= GEN[i];
  }
  return chk >>> 0;
}
function hrpExpand(hrp: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) >> 5);
  out.push(0);
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) & 31);
  return out;
}
function decodeBech32(addr: string): { hrp: string; enc: "bech32" | "bech32m" } | null {
  if (addr !== addr.toLowerCase()) return null;
  const pos = addr.lastIndexOf("1");
  if (pos < 1 || pos + 7 > addr.length) return null;
  const hrp = addr.slice(0, pos);
  const data: number[] = [];
  for (const c of addr.slice(pos + 1)) {
    const d = CHARSET.indexOf(c);
    if (d === -1) return null;
    data.push(d);
  }
  const pm = polymod([...hrpExpand(hrp), ...data]);
  if (pm === 1) return { hrp, enc: "bech32" };
  if (pm === 0x2bc830a3) return { hrp, enc: "bech32m" };
  return null;
}

// --- Base58Check -----------------------------------------------------------

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function b58decode(s: string): Uint8Array | null {
  const bytes: number[] = [0];
  for (const ch of s) {
    const val = B58.indexOf(ch);
    if (val === -1) return null;
    let carry = val;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  for (let k = 0; k < s.length && s[k] === "1"; k++) bytes.push(0);
  return Uint8Array.from(bytes.reverse());
}

// Returns the payload (version + data) with the 4-byte checksum verified & stripped.
function b58checkDecode(s: string): Uint8Array | null {
  const raw = b58decode(s);
  if (!raw || raw.length < 5) return null;
  const payload = raw.slice(0, raw.length - 4);
  const checksum = raw.slice(raw.length - 4);
  const h = sha256(sha256(payload));
  for (let i = 0; i < 4; i++) if (h[i] !== checksum[i]) return null;
  return payload;
}

function sha256(b: Uint8Array): Uint8Array {
  return Uint8Array.from(createHash("sha256").update(b).digest());
}
