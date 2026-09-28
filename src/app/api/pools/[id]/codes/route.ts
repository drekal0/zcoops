import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/domain/pools";
import { generateCodes } from "@/domain/codes";
import { isAdmin, manageKeyFromReq } from "@/lib/http";
import { verifyManageKey } from "@/domain/pools";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const pool = await getPool(params.id);
  if (!pool) return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  const manages = isAdmin(req) || (await verifyManageKey(pool.id, manageKeyFromReq(req)));
  if (!manages) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { count } = await req.json().catch(() => ({ count: 0 }));
  const n = Math.min(Math.max(Number(count) || 0, 1), 1000);
  const codes = await generateCodes(pool.id, n);
  return NextResponse.json({ codes });
}
