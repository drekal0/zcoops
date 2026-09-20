import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/domain/pools";
import { poolStats, recentClaims } from "@/domain/claims";
import { codeStats } from "@/domain/codes";
import { isAdmin } from "@/lib/http";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const pool = await getPool(params.id);
  if (!pool) return NextResponse.json({ error: "Pool not found" }, { status: 404 });

  const stats = await poolStats(pool.id);
  const codes = pool.claim_mode === "code" ? await codeStats(pool.id) : null;
  const remaining = Math.max(0, pool.max_claims - stats.claimed);

  const body: any = {
    pool: {
      id: pool.id, name: pool.name, network: pool.network,
      amount_per_claim: pool.amount_per_claim, max_claims: pool.max_claims,
      claim_mode: pool.claim_mode, status: pool.status,
    },
    stats: { ...stats, remaining },
    codes,
  };

  // Admins additionally get the recent-claims feed + deposit address.
  if (isAdmin(req)) {
    body.recent = await recentClaims(pool.id, 25);
    body.deposit_address = pool.deposit_address;
  }
  return NextResponse.json(body);
}
