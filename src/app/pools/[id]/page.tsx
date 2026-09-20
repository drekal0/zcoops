"use client";
import { useEffect, useRef, useState } from "react";

const TURNSTILE_SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY || "";

declare global {
  interface Window { turnstile?: any }
}

export default function ClaimPage({ params }: { params: { id: string } }) {
  const [pool, setPool] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [addr, setAddr] = useState("");
  const [code, setCode] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);
  const tsRef = useRef<HTMLDivElement>(null);
  const tsRendered = useRef(false);

  async function refresh() {
    const r = await fetch(`/api/pools/${params.id}/stats`);
    if (r.ok) { const d = await r.json(); setPool(d.pool); setStats(d.stats); }
  }
  useEffect(() => {
    refresh();
    // Prefill claim code from a QR / shared link (?code=ABCD2345)
    const c = new URLSearchParams(window.location.search).get("code");
    if (c) setCode(c.toUpperCase());
  }, []);

  // Mount Cloudflare Turnstile for public pools when a sitekey is configured.
  useEffect(() => {
    if (!pool || pool.claim_mode !== "public" || !TURNSTILE_SITEKEY) return;
    const render = () => {
      if (window.turnstile && tsRef.current && !tsRendered.current) {
        tsRendered.current = true;
        window.turnstile.render(tsRef.current, {
          sitekey: TURNSTILE_SITEKEY,
          callback: (t: string) => setCaptcha(t),
          "expired-callback": () => setCaptcha(""),
          "error-callback": () => setCaptcha(""),
        });
      }
    };
    const id = "cf-turnstile";
    if (!document.getElementById(id)) {
      const s = document.createElement("script");
      s.id = id;
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true; s.defer = true; s.onload = render;
      document.head.appendChild(s);
    } else render();
  }, [pool]);

  async function claim() {
    setMsg(null); setState("pending");
    try {
      const res = await fetch("/api/claim", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poolId: params.id, destAddress: addr, code: code || undefined, captchaToken: captcha || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Claim failed");
      const id = data.claimId;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const s = await (await fetch(`/api/claim?id=${id}`)).json();
        if (s.status === "sent") { setTxid(s.txid); setState("sent"); refresh(); return; }
        if (s.status === "failed") throw new Error(s.error || "Send failed");
      }
      setState("pending"); setMsg("Still processing — your claim is queued.");
    } catch (e: any) { setState("error"); setMsg(e.message); }
  }

  if (!pool) return <main><p className="muted">Loading pool…</p></main>;

  const needsCaptcha = pool.claim_mode === "public" && !!TURNSTILE_SITEKEY;

  return (
    <main>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ marginBottom: 0 }}>{pool.name}</h1>
        <span className={`pill ${pool.status === "active" ? "green" : ""}`}>{pool.network}</span>
      </div>
      <p className="muted">Claim {pool.amount_per_claim} ZEC {pool.claim_mode === "code" ? "with your event code" : "to your address"}.</p>

      {stats && (
        <div className="bar" style={{ margin: "10px 0 4px" }}>
          <i style={{ width: `${Math.min(100, (stats.claimed / pool.max_claims) * 100)}%` }} />
        </div>
      )}
      {stats && <p className="mono muted">{stats.claimed}/{pool.max_claims} claimed · {stats.remaining} left</p>}

      {state === "sent" ? (
        <div className="notice ok" style={{ marginTop: 18 }}>
          Sent! txid: <span className="mono">{txid}</span>
        </div>
      ) : stats?.remaining === 0 ? (
        <div className="notice err" style={{ marginTop: 18 }}>This pool is fully claimed.</div>
      ) : (
        <div className="panel" style={{ marginTop: 18 }}>
          <label>Your Zcash address</label>
          <input placeholder="u1… / zs… / t1…" value={addr} onChange={(e) => setAddr(e.target.value)} />
          {pool.claim_mode === "code" && (
            <>
              <label>Claim code</label>
              <input placeholder="ABCD2345" value={code} onChange={(e) => setCode(e.target.value)} />
            </>
          )}
          {needsCaptcha && <div ref={tsRef} style={{ marginTop: 16 }} />}
          {msg && <div className="notice err" style={{ marginTop: 14 }}>{msg}</div>}
          <div style={{ marginTop: 16 }}>
            <button onClick={claim} disabled={state === "pending" || !addr || (needsCaptcha && !captcha)}>
              {state === "pending" ? "Sending…" : `Claim ${pool.amount_per_claim} ZEC`}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
