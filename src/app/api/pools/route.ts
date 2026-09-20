import { NextRequest, NextResponse } from "next/server";
import { createPool, listPools } from "@/domain/pools";

export async function GET() {
  const pools = await listPools();
  return NextResponse.json({ pools });
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    if (!b.name || !b.owner || !b.amountPerClaim || !b.maxClaims) {
      return NextResponse.json({ error: "name, owner, amountPerClaim, maxClaims are required" }, { status: 400 });
    }
    const pool = await createPool({
      name: String(b.name),
      owner: String(b.owner),
      amountPerClaim: String(b.amountPerClaim),
      maxClaims: Number(b.maxClaims),
      cooldownSeconds: b.cooldownSeconds ? Number(b.cooldownSeconds) : 0,
      claimMode: b.claimMode === "code" ? "code" : "public",
      expiresAt: b.expiresAt ? Number(b.expiresAt) : null,
    });
    return NextResponse.json({ pool }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
