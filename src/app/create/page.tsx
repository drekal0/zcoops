"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreatePool() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", owner: "", amountPerClaim: "0.01", maxClaims: "100",
    claimMode: "code", cooldownSeconds: "0",
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  async function submit() {
    setErr(null); setBusy(true);
    try {
      const res = await fetch("/api/pools", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create pool");
      router.push(`/pools/${data.pool.id}/admin`);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <main>
      <h1>Create a pool</h1>
      <p className="muted">Set it up once. You&apos;ll get a claim link and an admin dashboard.</p>
      <div className="panel" style={{ marginTop: 18 }}>
        <label>Pool name</label>
        <input placeholder="ETHSafari 2026 — Zcash Booth" value={form.name} onChange={set("name")} />
        <label>Organizer (your handle)</label>
        <input placeholder="drekal0" value={form.owner} onChange={set("owner")} />
        <div className="row">
          <div style={{ flex: 1, minWidth: 180 }}>
            <label>Amount per claim (ZEC)</label>
            <input value={form.amountPerClaim} onChange={set("amountPerClaim")} />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label>Max claims</label>
            <input value={form.maxClaims} onChange={set("maxClaims")} />
          </div>
        </div>
        <div className="row">
          <div style={{ flex: 1, minWidth: 180 }}>
            <label>Claim mode</label>
            <select value={form.claimMode} onChange={set("claimMode")}>
              <option value="code">Code-gated (events — recommended)</option>
              <option value="public">Public (open drip)</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label>Per-network cooldown (sec, public only)</label>
            <input value={form.cooldownSeconds} onChange={set("cooldownSeconds")} />
          </div>
        </div>
        {err && <div className="notice err" style={{ marginTop: 16 }}>{err}</div>}
        <div style={{ marginTop: 18 }}>
          <button onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create pool"}</button>
        </div>
      </div>
    </main>
  );
}
