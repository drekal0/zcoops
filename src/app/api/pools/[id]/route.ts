import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/domain/pools";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const pool = await getPool(params.id);
  if (!pool) return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  // Never leak the deposit address or owner to the public claim page payload here;
  // the claim page only needs display fields.
  const { deposit_address, owner, ...pub } = pool as any;
  return NextResponse.json({ pool: pub });
}
