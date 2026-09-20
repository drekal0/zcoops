// Dev-only: mint checksum-valid Zcash addresses for tests/seeds. Not imported by the app.
import { createHash } from "crypto";

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
function bech32(hrp: string, data5: number[], enc: "bech32" | "bech32m"): string {
  const c = enc === "bech32m" ? 0x2bc830a3 : 1;
  const pm = polymod([...hrpExpand(hrp), ...data5, 0, 0, 0, 0, 0, 0]) ^ c;
  const cks: number[] = [];
  for (let i = 0; i < 6; i++) cks.push((pm >> (5 * (5 - i))) & 31);
  return hrp + "1" + [...data5, ...cks].map((d) => CHARSET[d]).join("");
}
const sha256 = (b: Uint8Array) => Uint8Array.from(createHash("sha256").update(b).digest());
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58encode(bytes: Uint8Array): string {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0; }
    while (carry > 0) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let out = "";
  for (let k = 0; k < bytes.length && bytes[k] === 0; k++) out += "1";
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return out;
}
function b58check(version: number[], hash20: Uint8Array): string {
  const payload = Uint8Array.from([...version, ...hash20]);
  const h = sha256(sha256(payload));
  return b58encode(Uint8Array.from([...payload, ...h.slice(0, 4)]));
}

const data = (n: number, salt = 0) => Array.from({ length: n }, (_, i) => (i * 7 + 3 + salt * 13) % 32);
const hash20 = Uint8Array.from(Array.from({ length: 20 }, (_, i) => (i * 11 + 5) & 0xff));

// Unified (bech32m) & sapling (bech32)
export const mintUnified = (net: "mainnet" | "testnet" | "regtest") =>
  bech32(net === "mainnet" ? "u" : net === "testnet" ? "utest" : "uregtest", data(40), "bech32m");
export const mintSapling = (net: "mainnet" | "testnet" | "regtest") =>
  bech32(net === "mainnet" ? "zs" : net === "testnet" ? "ztestsapling" : "zregtestsapling", data(43), "bech32");
// Transparent (base58check): tm/t2 = test, t1/t3 = mainnet
export const mintTransparentTest = () => b58check([0x1d, 0x25], hash20);   // tm P2PKH
export const mintTransparentMainnet = () => b58check([0x1c, 0xb8], hash20); // t1 P2PKH
// distinct, checksum-valid regtest UAs for tests/seeds
export const mintClaim = (salt: number) => bech32("uregtest", data(40, salt), "bech32m");
