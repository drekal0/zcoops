import { db, now } from "@/lib/db";
import { newClaimCode } from "@/lib/ids";

export async function generateCodes(poolId: string, count: number): Promise<string[]> {
  const codes: string[] = [];
  const ts = now();
  const tx = await db().transaction("write");
  try {
    for (let i = 0; i < count; i++) {
      const code = newClaimCode();
      await tx.execute({
        sql: `INSERT INTO claim_codes (code, pool_id, created_at) VALUES (?,?,?)`,
        args: [code, poolId, ts],
      });
      codes.push(code);
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
  return codes;
}

export async function codeStats(poolId: string) {
  const r = await db().execute({
    sql: `SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN redeemed_at IS NOT NULL THEN 1 ELSE 0 END) AS redeemed
          FROM claim_codes WHERE pool_id = ?`,
    args: [poolId],
  });
  const row = r.rows[0] as any;
  return { total: Number(row?.total ?? 0), redeemed: Number(row?.redeemed ?? 0) };
}
