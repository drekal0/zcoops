import { db, now } from "@/lib/db";
import { newId } from "@/lib/ids";
import { pseudonymize } from "@/lib/hash";
import { getPool } from "./pools";
import { validateZcashAddress } from "@/wallet/address";
import { verifyCaptcha } from "@/lib/captcha";
import type { Network } from "@/wallet/adapter";

export interface ClaimInput {
  poolId: string;
  destAddress: string;
  ip: string;
  code?: string;
  captchaToken?: string;
}

export type ClaimOk = { ok: true; claimId: string };
export type ClaimErr = { ok: false; reason: string };

/**
 * enqueueClaim — validates against every abuse gate, then inserts a QUEUED claim
 * (optionally consuming a code atomically). It does NOT send; the dispenser
 * worker drains the queue single-flight. Keeping validation + insert in one
 * write transaction is what prevents oversubscribing a pool under load.
 */
export async function enqueueClaim(input: ClaimInput): Promise<ClaimOk | ClaimErr> {
  const pool = await getPool(input.poolId);
  if (!pool) return { ok: false, reason: "Pool not found." };
  if (pool.status !== "active") {
    const reason =
      pool.status === "provisioning" || pool.status === "provisioning_inflight"
        ? "This pool is still being set up — check back in a moment."
        : pool.status === "provision_failed"
        ? "This pool failed to set up."
        : "This pool is not active.";
    return { ok: false, reason };
  }
  if (pool.expires_at && now() > pool.expires_at)
    return { ok: false, reason: "This pool has expired." };

  const destAddress = input.destAddress.trim();
  const addrCheck = validateZcashAddress(destAddress, pool.network as Network);
  if (!addrCheck.ok) return { ok: false, reason: addrCheck.reason };

  // Public pools: require a passing captcha (skipped if Turnstile isn't configured).
  if (pool.claim_mode === "public") {
    const human = await verifyCaptcha(input.captchaToken, input.ip);
    if (!human) return { ok: false, reason: "Captcha check failed — please try again." };
  }

  const destHash = pseudonymize(destAddress);
  const ipHash = pseudonymize(input.ip);
  const client = db();

  // Capacity: claimed (queued + sent) must stay under max_claims.
  const usedR = await client.execute({
    sql: `SELECT COUNT(*) AS n FROM claims WHERE pool_id = ? AND status IN ('queued','sent')`,
    args: [pool.id],
  });
  if (Number((usedR.rows[0] as any).n) >= pool.max_claims)
    return { ok: false, reason: "This pool is fully claimed." };

  // One claim per destination address per pool.
  const dupR = await client.execute({
    sql: `SELECT 1 FROM claims WHERE pool_id = ? AND dest_hash = ? AND status IN ('queued','sent') LIMIT 1`,
    args: [pool.id, destHash],
  });
  if (dupR.rows.length) return { ok: false, reason: "This address already claimed from this pool." };

  // Public mode: per-IP cooldown. (Code mode leans on the code instead.)
  if (pool.claim_mode === "public" && pool.cooldown_seconds > 0) {
    const cutoff = now() - pool.cooldown_seconds;
    const cdR = await client.execute({
      sql: `SELECT MAX(created_at) AS last FROM claims WHERE pool_id = ? AND ip_hash = ?`,
      args: [pool.id, ipHash],
    });
    const last = Number((cdR.rows[0] as any).last ?? 0);
    if (last > cutoff)
      return { ok: false, reason: `Please wait before claiming again from this network.` };
  }

  const claimId = newId("clm");
  const ts = now();

  // Atomic: (optionally) consume a code + insert the claim together.
  const tx = await client.transaction("write");
  try {
    if (pool.claim_mode === "code") {
      if (!input.code) { await tx.rollback(); return { ok: false, reason: "A claim code is required." }; }
      const codeR = await tx.execute({
        sql: `SELECT code, redeemed_at FROM claim_codes WHERE pool_id = ? AND code = ?`,
        args: [pool.id, input.code.trim().toUpperCase()],
      });
      const codeRow = codeR.rows[0] as any;
      if (!codeRow) { await tx.rollback(); return { ok: false, reason: "Invalid claim code." }; }
      if (codeRow.redeemed_at) { await tx.rollback(); return { ok: false, reason: "This code was already used." }; }
      await tx.execute({
        sql: `UPDATE claim_codes SET redeemed_by = ?, redeemed_at = ? WHERE code = ? AND redeemed_at IS NULL`,
        args: [claimId, ts, codeRow.code],
      });
    }

    await tx.execute({
      sql: `INSERT INTO claims
        (id, pool_id, dest_hash, dest_address, ip_hash, amount, status, created_at)
        VALUES (?,?,?,?,?,?, 'queued', ?)`,
      args: [claimId, pool.id, destHash, destAddress, ipHash, pool.amount_per_claim, ts],
    });
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }

  return { ok: true, claimId };
}

export async function getClaim(id: string) {
  const r = await db().execute({ sql: `SELECT * FROM claims WHERE id = ?`, args: [id] });
  return r.rows[0] ?? null;
}

export async function poolStats(poolId: string) {
  const r = await db().execute({
    sql: `SELECT
            SUM(CASE WHEN status IN ('queued','sent') THEN 1 ELSE 0 END) AS claimed,
            SUM(CASE WHEN status = 'sent'  THEN 1 ELSE 0 END) AS sent,
            SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
            COUNT(DISTINCT dest_hash) AS unique_claimers
          FROM claims WHERE pool_id = ?`,
    args: [poolId],
  });
  const row = r.rows[0] as any;
  return {
    claimed: Number(row?.claimed ?? 0),
    sent: Number(row?.sent ?? 0),
    pending: Number(row?.pending ?? 0),
    failed: Number(row?.failed ?? 0),
    uniqueClaimers: Number(row?.unique_claimers ?? 0),
  };
}

export async function recentClaims(poolId: string, limit = 20) {
  const r = await db().execute({
    sql: `SELECT id, status, txid, amount, created_at, sent_at
          FROM claims WHERE pool_id = ? ORDER BY created_at DESC LIMIT ?`,
    args: [poolId, limit],
  });
  return r.rows;
}

