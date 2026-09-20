import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/domain/pools";
import { generateCodes } from "@/domain/codes";
import { isAdmin } from "@/lib/http";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const pool = await getPool(params.id);
  if (!pool) return NextResponse.json({ error: "Pool not found" }, { status: 404 });

  const { count } = await req.json().catch(() => ({ count: 0 }));
  const n = Math.min(Math.max(Number(count) || 0, 1), 1000);
  const codes = await generateCodes(pool.id, n);
  return NextResponse.json({ codes });
}
