import { NextRequest, NextResponse } from "next/server";
import { getPool, toPublicPool } from "@/domain/pools";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const pool = await getPool(params.id);
  if (!pool) return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  return NextResponse.json({ pool: toPublicPool(pool) });
}
