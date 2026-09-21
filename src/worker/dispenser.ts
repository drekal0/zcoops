import "dotenv/config";
import { db, now } from "@/lib/db";
import { wallet } from "@/wallet";
import { provisionPool, nextProvisioningPoolId } from "@/domain/pools";

/**
 * Dispenser worker — the single most important piece of the backend.
 *
 * A single Zcash wallet CANNOT send concurrently: parallel sends race on note
 * selection and get stuck. So claims are never sent inside the HTTP request.
 * They land as 'queued' and THIS worker drains them ONE AT A TIME.
 *
 * Run it as its own process (`npm run worker`), separate from the web tier, so
 * the wallet/keys live outside anything exposed to claim traffic.
 *
 * M2 upgrade: batch N queued claims for the same pool into one multi-output tx
 * (cheaper under ZIP-317, faster to confirm).
 */

const POLL_MS = 1500;
let running = true;

async function provisionNext(): Promise<boolean> {
  const poolId = await nextProvisioningPoolId();
  if (!poolId) return false;
  const res = await provisionPool(poolId);
  if (res.ok) console.log(`[dispenser] provisioned pool ${poolId}`);
  else console.error(`[dispenser] provision FAILED ${poolId}: ${res.error}`);
  return true;
}

async function claimNext() {
  const client = db();
  // Grab the oldest queued claim.
  const r = await client.execute(
    `SELECT c.id, c.pool_id, c.dest_address, c.amount,
            p.deposit_address AS from_address, p.wallet_ref AS from_ref
     FROM claims c JOIN pools p ON p.id = c.pool_id
     WHERE c.status = 'queued' ORDER BY c.created_at ASC LIMIT 1`
  );
  const claim = r.rows[0] as any;
  if (!claim) return false;

  // Mark in-flight so a second worker instance won't double-send.
  const lock = await client.execute({
    sql: `UPDATE claims SET status = 'sending' WHERE id = ? AND status = 'queued'`,
    args: [claim.id],
  });
  if (lock.rowsAffected === 0) return true; // someone else took it

  try {
    const { txid } = await wallet().send({
      poolId: claim.pool_id,
      fromRef: String(claim.from_ref ?? ""),
      fromAddress: String(claim.from_address),
      toAddress: claim.dest_address,
      amount: String(claim.amount),
    });
    // On success, record txid AND null out the raw address (we kept it only
    // long enough to build the tx).
    await client.execute({
      sql: `UPDATE claims SET status='sent', txid=?, sent_at=?, dest_address=NULL WHERE id=?`,
      args: [txid, now(), claim.id],
    });
    console.log(`[dispenser] sent ${claim.id} -> ${txid}`);
  } catch (e: any) {
    await client.execute({
      sql: `UPDATE claims SET status='failed', error=? WHERE id=?`,
      args: [String(e?.message ?? e).slice(0, 500), claim.id],
    });
    console.error(`[dispenser] FAILED ${claim.id}: ${e?.message ?? e}`);
  }
  return true;
}

async function loop() {
  console.log(
    `[dispenser] up. backend=${process.env.WALLET_BACKEND || "mock"} network=${process.env.WALLET_NETWORK || "regtest"}`
  );
  while (running) {
    let worked = false;
    try {
      // Provision new pools first so they become claimable quickly, then send.
      const provisioned = await provisionNext();
      const claimed = await claimNext();
      worked = provisioned || claimed;
    } catch (e) {
      console.error("[dispenser] loop error:", e);
    }
    if (!worked) await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

process.on("SIGINT", () => { running = false; console.log("\n[dispenser] shutting down"); });
process.on("SIGTERM", () => { running = false; });

// Recover any 'sending' rows orphaned by a crash back to 'queued' at startup.
(async () => {
  await db().execute(`UPDATE claims SET status='queued' WHERE status='sending'`);
  await db().execute(`UPDATE pools SET status='provisioning' WHERE status='provisioning_inflight'`);
  await loop();
  process.exit(0);
})();
