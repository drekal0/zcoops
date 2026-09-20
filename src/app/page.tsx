import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>Claim pools for Zcash events.</h1>
      <p className="muted" style={{ maxWidth: 560 }}>
        Fund a pool for your workshop, booth, or meetup. Hand out claim codes,
        share a link, and watch redemptions land in real time. One shielded
        wallet underneath — each pool accounted for separately.
      </p>
      <div className="row" style={{ marginTop: 22 }}>
        <Link href="/create"><button>Create a pool</button></Link>
        <span className="pill gold">MVP · regtest/testnet</span>
      </div>

      <h2>How it works</h2>
      <div className="panel grid" style={{ gap: 10 }}>
        <div className="row"><span className="pill">1</span><span>Create a pool: amount per claim, how many, public or code-gated.</span></div>
        <div className="row"><span className="pill">2</span><span>Generate claim codes (or open it publicly with a cooldown + captcha).</span></div>
        <div className="row"><span className="pill">3</span><span>Share the claim link. Claims queue and send one at a time.</span></div>
        <div className="row"><span className="pill">4</span><span>Watch the dashboard: claimed, remaining, unique wallets, redemption rate.</span></div>
      </div>
    </main>
  );
}
