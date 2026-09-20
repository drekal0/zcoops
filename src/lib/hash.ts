import { createHash } from "crypto";
import { config } from "./config";

/**
 * One-way hash for values we must dedupe on but should not store in the clear:
 * claim destination addresses and claimant IPs. Against a privacy coin, logging
 * raw claim addresses is a deanonymization vector — so we only keep the hash.
 */
export function pseudonymize(value: string): string {
  return createHash("sha256")
    .update(config.security.hashSalt + ":" + value.trim().toLowerCase())
    .digest("hex");
}
