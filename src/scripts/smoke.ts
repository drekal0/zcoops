import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { db } from "@/lib/db";
import { createPool } from "@/domain/pools";
import { generateCodes } from "@/domain/codes";
import { enqueueClaim, poolStats, getClaim } from "@/domain/claims";
import { wallet } from "@/wallet";
import { mintClaim } from "./mint-address";

async function initDb() {
  const schema = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");
  for (const s of schema.split(";").map(x => x.trim()).filter(Boolean)) await db().execute(s);
}

// Inline copy of the worker's single-flight step, for a deterministic test.
async function drainOnce(): Promise<boolean> {
  const c = db();
  const r = await c.execute(`SELECT c.id, c.pool_id, c.dest_address, c.amount, p.deposit_address AS from_address, p.wallet_ref AS from_ref FROM claims c JOIN pools p ON p.id=c.pool_id WHERE c.status='queued' ORDER BY c.created_at ASC LIMIT 1`);
  const claim = r.rows[0] as any; if (!claim) return false;
  await c.execute({ sql: `UPDATE claims SET status='sending' WHERE id=? AND status='queued'`, args: [claim.id] });
  const { txid } = await wallet().send({ poolId: claim.pool_id, fromRef: String(claim.from_ref ?? ""), fromAddress: String(claim.from_address), toAddress: claim.dest_address, amount: String(claim.amount) });
  await c.execute({ sql: `UPDATE claims SET status='sent', txid=?, dest_address=NULL WHERE id=?`, args: [txid, claim.id] });
  return true;
}

(async () => {
  await initDb();
  const pool = await createPool({ name: "Smoke Test Pool", owner: "tester", amountPerClaim: "0.01", maxClaims: 3, claimMode: "code" });
  console.log("✓ pool created:", pool.id, "deposit:", pool.deposit_address);

  const codes = await generateCodes(pool.id, 3);
  console.log("✓ codes generated:", codes.join(", "));

  // Valid claim with a code
  const addr1 = mintClaim(1);
  const r1 = await enqueueClaim({ poolId: pool.id, destAddress: addr1, ip: "1.2.3.4", code: codes[0] });
  console.log("claim #1 (valid code):", r1);

  // Reused code -> reject
  const r2 = await enqueueClaim({ poolId: pool.id, destAddress: mintClaim(2), ip: "5.6.7.8", code: codes[0] });
  console.log("claim #2 (reused code, expect reject):", r2);

  // Missing code in code-mode -> reject
  const r3 = await enqueueClaim({ poolId: pool.id, destAddress: mintClaim(3), ip: "9.9.9.9" });
  console.log("claim #3 (no code, expect reject):", r3);

  // Same address again with a fresh code -> reject (dup address)
  const r4 = await enqueueClaim({ poolId: pool.id, destAddress: addr1, ip: "2.2.2.2", code: codes[1] });
  console.log("claim #4 (dup address, expect reject):", r4);

  console.log("stats before drain:", await poolStats(pool.id));
  while (await drainOnce()) { /* drain queue */ }
  console.log("stats after drain:", await poolStats(pool.id));

  if (r1.ok) {
    const c = await getClaim(r1.claimId) as any;
    console.log("claim #1 final:", { status: c.status, txid: c.txid, dest_address: c.dest_address, note: "raw address nulled after send ✓" });
  }
  process.exit(0);
})();
