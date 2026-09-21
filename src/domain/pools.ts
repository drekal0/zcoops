import { db, now } from "@/lib/db";
import { newId } from "@/lib/ids";
import { wallet } from "@/wallet";
import { config } from "@/lib/config";

export type PoolStatus =
  | "provisioning"
  | "provisioning_inflight"
  | "active"
  | "paused"
  | "closed"
  | "provision_failed";

export interface Pool {
  id: string;
  name: string;
  owner: string;
  kind: "distribution" | "collection";
  network: string;
  deposit_address: string | null;
  wallet_ref: string | null;
  provision_error: string | null;
  amount_per_claim: string;
  max_claims: number;
  cooldown_seconds: number;
  claim_mode: "public" | "code";
  status: PoolStatus;
  expires_at: number | null;
  created_at: number;
}

export interface CreatePoolInput {
  name: string;
  owner: string;
  amountPerClaim: string;
  maxClaims: number;
  cooldownSeconds?: number;
  claimMode?: "public" | "code";
  expiresAt?: number | null;
}

/**
 * Create a pool WITHOUT touching the wallet. The web tier (Vercel) never reaches
 * the node: the pool starts as `provisioning` with no deposit address, and the
 * worker — which is the only process with wallet access — provisions the account
 * and flips it to `active` (see provisionPool + the dispenser).
 */
export async function createPool(input: CreatePoolInput): Promise<Pool> {
  const id = newId("pool");
  const pool: Pool = {
    id,
    name: input.name.trim(),
    owner: input.owner.trim(),
    kind: "distribution",
    network: config.wallet.network, // from env, no wallet() call
    deposit_address: null,
    wallet_ref: null,
    provision_error: null,
    amount_per_claim: input.amountPerClaim,
    max_claims: input.maxClaims,
    cooldown_seconds: input.cooldownSeconds ?? 0,
    claim_mode: input.claimMode ?? "public",
    status: "provisioning",
    expires_at: input.expiresAt ?? null,
    created_at: now(),
  };
  await db().execute({
    sql: `INSERT INTO pools
      (id,name,owner,kind,network,deposit_address,wallet_ref,amount_per_claim,max_claims,cooldown_seconds,claim_mode,status,expires_at,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      pool.id, pool.name, pool.owner, pool.kind, pool.network, pool.deposit_address, pool.wallet_ref,
      pool.amount_per_claim, pool.max_claims, pool.cooldown_seconds,
      pool.claim_mode, pool.status, pool.expires_at, pool.created_at,
    ],
  });
  return pool;
}

export async function getPool(id: string): Promise<Pool | null> {
  const r = await db().execute({ sql: `SELECT * FROM pools WHERE id = ?`, args: [id] });
  return (r.rows[0] as unknown as Pool) ?? null;
}

export async function listPools(): Promise<Pool[]> {
  const r = await db().execute(`SELECT * FROM pools ORDER BY created_at DESC`);
  return r.rows as unknown as Pool[];
}

/** Oldest pool awaiting provisioning, or null. Used by the worker. */
export async function nextProvisioningPoolId(): Promise<string | null> {
  const r = await db().execute(
    `SELECT id FROM pools WHERE status = 'provisioning' ORDER BY created_at ASC LIMIT 1`
  );
  return (r.rows[0] as any)?.id ?? null;
}

/**
 * Provision one pool: derive its deposit account/address from the wallet and
 * activate it. Runs ONLY on the worker (it's the wallet-holder). Locks the row
 * first so a second worker can't double-provision; a crash mid-provision is
 * recovered at worker startup (provisioning_inflight -> provisioning).
 */
export async function provisionPool(poolId: string): Promise<{ ok: boolean; error?: string }> {
  const client = db();
  const lock = await client.execute({
    sql: `UPDATE pools SET status = 'provisioning_inflight' WHERE id = ? AND status = 'provisioning'`,
    args: [poolId],
  });
  if (lock.rowsAffected === 0) return { ok: false, error: "not in provisioning state" };

  try {
    const deposit = await wallet().deriveDepositAddress(poolId);
    await client.execute({
      sql: `UPDATE pools SET deposit_address = ?, wallet_ref = ?, provision_error = NULL, status = 'active' WHERE id = ?`,
      args: [deposit.address, deposit.ref, poolId],
    });
    return { ok: true };
  } catch (e: any) {
    await client.execute({
      sql: `UPDATE pools SET status = 'provision_failed', provision_error = ? WHERE id = ?`,
      args: [String(e?.message ?? e).slice(0, 500), poolId],
    });
    return { ok: false, error: String(e?.message ?? e) };
  }
}
