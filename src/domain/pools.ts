import { db, now } from "@/lib/db";
import { newId } from "@/lib/ids";
import { wallet } from "@/wallet";

export interface Pool {
  id: string;
  name: string;
  owner: string;
  kind: "distribution" | "collection";
  network: string;
  deposit_address: string;
  wallet_ref: string | null;
  amount_per_claim: string;
  max_claims: number;
  cooldown_seconds: number;
  claim_mode: "public" | "code";
  status: "active" | "paused" | "closed";
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

export async function createPool(input: CreatePoolInput): Promise<Pool> {
  const id = newId("pool");
  const w = wallet();
  const deposit = await w.deriveDepositAddress(id);
  const pool: Pool = {
    id,
    name: input.name.trim(),
    owner: input.owner.trim(),
    kind: "distribution", // collection pools (crowdfund) land in M4
    network: w.network,
    deposit_address: deposit.address,
    wallet_ref: deposit.ref,
    amount_per_claim: input.amountPerClaim,
    max_claims: input.maxClaims,
    cooldown_seconds: input.cooldownSeconds ?? 0,
    claim_mode: input.claimMode ?? "public",
    status: "active",
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
