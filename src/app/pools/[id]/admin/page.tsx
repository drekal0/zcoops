"use client";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function AdminDashboard({ params }: { params: { id: string } }) {
  const [token, setToken] = useState("");
  const [data, setData] = useState<any>(null);
  const [count, setCount] = useState("50");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await fetch(`/api/pools/${params.id}/stats`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (r.ok) setData(await r.json());
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 4000); // live-ish dashboard
    return () => clearInterval(t);
  }, [token]);

  async function genCodes() {
    setErr(null); setCodes(null);
    const r = await fetch(`/api/pools/${params.id}/codes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ count: Number(count) }),
    });
    const d = await r.json();
    if (!r.ok) { setErr(d.error || "Failed"); return; }
    setCodes(d.codes);
  }

  if (!data) return (
    <main>
      <h1>Pool dashboard</h1>
      <div className="panel">
        <label>Admin token</label>
        <input placeholder="ADMIN_TOKEN from your .env" value={token} onChange={(e) => setToken(e.target.value)} />
        <p className="muted mono" style={{ marginTop: 8 }}>Enter the token to unlock the full feed.</p>
      </div>
    </main>
  );

  const { pool, stats, codes: codeStats, recent } = data;
  const claimUrl = typeof window !== "undefined" ? `${window.location.origin}/pools/${pool.id}` : "";

  return (
    <main>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ marginBottom: 0 }}>{pool.name}</h1>
        <span className={`pill ${pool.status === "active" ? "green" : ""}`}>{pool.status} · {pool.network}</span>
      </div>
      <p className="muted mono">Claim link: <a href={`/pools/${pool.id}`}>{claimUrl}</a></p>

      <div className="grid stat-grid" style={{ marginTop: 18 }}>
        <div className="stat"><div className="n">{stats.claimed}</div><div className="l">Claimed</div></div>
        <div className="stat"><div className="n">{stats.remaining}</div><div className="l">Remaining</div></div>
        <div className="stat"><div className="n">{stats.uniqueClaimers}</div><div className="l">Unique wallets</div></div>
        <div className="stat"><div className="n">{stats.pending}</div><div className="l">Pending</div></div>
        <div className="stat"><div className="n">{stats.sent}</div><div className="l">Sent</div></div>
        {stats.failed > 0 && <div className="stat"><div className="n" style={{ color: "var(--red)" }}>{stats.failed}</div><div className="l">Failed</div></div>}
      </div>

      <h2>Funding</h2>
      <div className="panel">
        {pool.status === "active" && data.deposit_address ? (
          <>
            <p className="muted mono" style={{ marginTop: 0 }}>Send ZEC to this address to fund the pool:</p>
            <div className="code" style={{ textAlign: "left", wordBreak: "break-all" }}>{data.deposit_address}</div>
          </>
        ) : pool.status === "provision_failed" ? (
          <div className="notice err" style={{ margin: 0 }}>
            Provisioning failed{data.provision_error ? `: ${data.provision_error}` : ""}. Check the worker and wallet backend.
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>Provisioning the deposit address… this updates automatically once the worker picks it up.</p>
        )}
      </div>

      {codeStats && (
        <>
          <h2>Claim codes</h2>
          <div className="panel">
            <p className="mono">{codeStats.redeemed}/{codeStats.total} redeemed</p>
            <div className="row" style={{ marginTop: 8 }}>
              <input style={{ maxWidth: 120 }} value={count} onChange={(e) => setCount(e.target.value)} />
              <button className="ghost" onClick={genCodes}>Generate codes</button>
            </div>
            {err && <div className="notice err" style={{ marginTop: 12 }}>{err}</div>}
            {codes && (
              <>
                <div className="row" style={{ justifyContent: "space-between", marginTop: 14 }}>
                  <p className="muted mono" style={{ margin: 0 }}>Save these now — they won&apos;t be shown again. Print &amp; hand out at your booth:</p>
                  <button className="ghost" onClick={() => window.print()}>Print QR sheet</button>
                </div>
                <div className="qrsheet">
                  {codes.map((c) => (
                    <div className="qrcard" key={c}>
                      <QRCodeSVG
                        value={`${claimUrl}?code=${c}`}
                        size={116}
                        bgColor="#ffffff"
                        fgColor="#0f1115"
                        level="M"
                        includeMargin
                      />
                      <div className="code" style={{ marginTop: 8 }}>{c}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {recent && (
        <>
          <h2>Recent claims</h2>
          <div className="panel" style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Claim</th><th>Status</th><th>Txid</th><th>When</th></tr></thead>
              <tbody>
                {recent.map((c: any) => (
                  <tr key={c.id}>
                    <td className="mono">{c.id.slice(0, 12)}…</td>
                    <td><span className={`pill ${c.status === "sent" ? "green" : c.status === "failed" ? "" : "gold"}`}>{c.status}</span></td>
                    <td className="mono">{c.txid ? c.txid.slice(0, 16) + "…" : "—"}</td>
                    <td className="muted">{new Date(c.created_at * 1000).toLocaleTimeString()}</td>
                  </tr>
                ))}
                {recent.length === 0 && <tr><td colSpan={4} className="muted">No claims yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
