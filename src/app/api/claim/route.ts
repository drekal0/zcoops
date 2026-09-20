import { NextRequest, NextResponse } from "next/server";
import { enqueueClaim, getClaim } from "@/domain/claims";
import { clientIp } from "@/lib/http";

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    if (!b.poolId || !b.destAddress) {
      return NextResponse.json({ error: "poolId and destAddress are required" }, { status: 400 });
    }
    // Captcha for public pools is verified inside enqueueClaim (Turnstile).
    const result = await enqueueClaim({
      poolId: String(b.poolId),
      destAddress: String(b.destAddress),
      ip: clientIp(req),
      code: b.code ? String(b.code) : undefined,
      captchaToken: b.captchaToken ? String(b.captchaToken) : undefined,
    });
    if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
    return NextResponse.json({ claimId: result.claimId, status: "queued" }, { status: 202 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}

// Poll claim status: /api/claim?id=clm_...
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const claim = (await getClaim(id)) as any;
  if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ status: claim.status, txid: claim.txid ?? null, error: claim.error ?? null });
}
