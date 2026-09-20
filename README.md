# zcoops — Zcash community claim pools

A multi-tenant, event-oriented faucet. Communities create their own **pool** for a
workshop / booth / meetup, fund it, hand out claim codes (or open it publicly),
share a link, and watch redemptions land in real time.

This is not a clone of a single public tap. The product surface is the
**organizer's** experience: create → fund → distribute → prove it worked.

> Status: **M1 MVP**. Default wallet backend is `mock` (no chain) so you can run
> the whole thing locally in one minute. Real sends drop in behind the same
> interface via the **Z3 stack** (Zebra + Zallet) — see *Wallet backend* and *Roadmap*.

---

## Quick start

```bash
cp .env.example .env      # defaults are fine for local (mock backend)
npm install
npm run db:init           # apply schema to local.db
npm run seed              # optional: creates a demo pool + 10 codes, prints links

# two processes:
npm run dev               # web app on http://localhost:3000
npm run worker            # dispenser queue drainer (separate process, on purpose)
```

Open the admin link the seed prints, enter the `ADMIN_TOKEN` from your `.env`,
and you have a live dashboard. The claim link works with the seeded codes.

`npm run smoke` equivalent: `npx tsx src/scripts/smoke.ts` exercises the full
flow (create → code-gate → dedupe/abuse rejections → queue → send) headless.

---

## Architecture

```
Browser ─┐
         │  claim (HTTP, fast, never sends)      ┌───────────────┐
         ▼                                       │   dispenser   │  ← separate process
   Next.js app ── enqueue 'queued' claim ──▶ DB ─┤  (single-flight│    holds the wallet,
   (App Router)                                  │   queue drainer)│    isolated from web
         ▲                                       └──────┬────────┘
         │  live stats (poll)                           │ send() one at a time
         └──────────────── DB ◀─────────────────────────┘
                                                   WalletAdapter → mock | zallet | zingolib
```

Everything above the `WalletAdapter` interface is chain-agnostic and unit-testable.
Swapping testnet → mainnet or Zallet ↔ zingolib is an env change, not a rewrite.

### Pool accounting — the Zcash-native part

The hard question in a multi-pool faucet: keep each community's money separate
and provable without running a wallet per community.

The model uses **one ZIP-32 account per pool under a single wallet seed**. One
seed, custodied by the wallet — but each pool is its own account, so it has its
own deposit address, its own on-chain balance, and its own spend authority, all
recoverable from that one seed. Accounts (not diversified addresses) are what
actually keep one pool's funds from mixing with another's: diversified addresses
under an account share that account's balance, so they can't segregate money
between pools. Each pool's balance is independently verifiable on-chain; the DB
is an index over that truth, not the source of it.

The `mock` adapter models this today (fake accounts). The real backend is your
**Zebra node + Zallet** via the `zallet` adapter over JSON-RPC — zcoops stays pure
TypeScript and never holds keys; Zallet does. `zingolib` (lightwallet client
against Zaino) is the alternative. Transitioning from mock to your synced node is
**config only** — see [`docs/wallet-z3.md`](docs/wallet-z3.md). Dev loop: run the
Zcash Foundation's `ZcashFoundation/z3` (Zebra + Zallet, optional Zaino) in
regtest via Docker Compose — up in seconds, same compose runs testnet/mainnet.
This replaces the old ZecKit regtest path.

### Why the dispenser is its own process

A single Zcash wallet **cannot send concurrently** — parallel shielded sends
race on note selection and get stuck. So claims are *never* sent inside the HTTP
request. They land as `queued`; the worker drains them one at a time. Running it
as a separate process also keeps the wallet/keys out of the web tier.

M2 upgrade: batch N queued claims for a pool into one multi-output tx — cheaper
under ZIP-317 (per-input/output fees) and faster to confirm.

### Anti-abuse

- **Code mode** (recommended for events): one-time codes / QR at the booth.
  Sidesteps most sybil pressure and gives clean "187/200 redeemed" analytics.
- **Public mode**: per-IP cooldown + per-address dedupe + **Cloudflare Turnstile
  captcha** (set `TURNSTILE_SECRET` + `NEXT_PUBLIC_TURNSTILE_SITEKEY`; the gate is
  skipped when unset, so dev needs no setup).
- Every pool has a hard `max_claims` cap so a funding mistake can't drain the
  shared wallet.
- Claim addresses and IPs are **hashed before they touch the DB** (`src/lib/hash.ts`).
  Raw destination address is kept only until the tx is built, then nulled.
  Logging plaintext claim addresses against a privacy coin is a deanonymization
  vector; this avoids it.
- **Real address validation**: `src/wallet/address.ts` verifies the checksum
  (Base58Check for transparent, Bech32/Bech32m for sapling/unified) and the
  network prefix, so wrong-network or fat-fingered addresses are rejected at
  claim time, not silently at send.
- **QR redemption**: the admin dashboard renders a scannable QR per generated
  code (a prefilled claim link) with a print sheet for booths; the claim page
  reads `?code=` and fills it in.

---

## Layout

```
db/schema.sql            pools (kind: distribution|collection) · claims · claim_codes
src/lib/                 config, db client, hashing, ids, http helpers
src/wallet/              adapter interface + address validation + mock / zallet (RPC) / zingolib(stub)
src/domain/              pools · codes · claims (enqueue = all abuse gates + insert)
src/worker/dispenser.ts  single-flight queue drainer (npm run worker)
src/scripts/             db-init · seed · smoke
src/app/                 landing · /create · /pools/[id] (claim) · /pools/[id]/admin
src/app/api/             pools, pools/[id], stats, codes, claim
```

Auth in this MVP is a single shared `ADMIN_TOKEN` (Bearer). Real multi-organizer
auth is M3 — see below.

---

## Design system

Consistent with the Zcash ecosystem and ZecHub brand:

- **Type** (same as Zcash Builders): Instrument Serif (display headings +
  numerals), Inter (UI/body), JetBrains Mono (addresses, txids, codes), loaded
  via `next/font`.
- **Color**: Zcash gold `#f4b728` is the primary action/brand color; **ZecHub
  blue `#1d71b8`** (sampled from the official ZecHub logo) is the secondary
  accent — links and the claim-progress gradient (gold → blue), on the dark
  scheme. Tokens live in `src/app/globals.css` (`--gold`, `--blue`,
  `--blue-bright`).

## Roadmap (agile, each milestone independently shippable)

- **M0 — Spike ✅** Diversified-address accounting + single queued send proven
  against the mock adapter. De-risks the whole design first.
- **M1 — MVP (this repo)** Create pool → fund → generate codes → share link →
  claimants redeem → organizer sees live claimed / remaining / unique. Single
  network. Enough to run at a real workshop and anchor a forum post.
- **M2** Real sends on the **Z3 stack** (Zebra + Zallet, optional Zaino): build
  the `zallet` adapter (regtest → testnet → mainnet), per-account pool
  segregation, batched sends. Plus public mode + captcha + rate limits hardened,
  CSV export, claim timeline / redemption-rate charts.
- **M3** Multi-organizer auth, pool templates per event type, embeddable claim
  widget + QR kiosk mode for booths.
- **M4 — Collection pools (crowdfunding)** The inverse of a claim pool: money
  flows *in*, many donors → one project, toward a goal. Same object otherwise
  (deposit address, balance, ledger, public page, dashboard), so the `kind`
  column (`distribution` | `collection`) is already in the schema to host it
  without a migration.
  - **Keep-what-you-raise** (GoFundMe-style): no escrow, no refunds, no
    all-or-nothing deadline logic — the campaign keeps whatever lands. Far
    smaller trust surface and no custody-of-refunds liability.
  - **Only the received total is public**, and it's the on-chain total
    verifiable via the campaign's own account deposit address — donors can
    prove the project received their ZEC. **Donors stay shielded**; who gave is
    not exposed. (Optional: encrypted memos let a donor attach a private note.)
  - Diversified-address accounting (from M2) does the heavy lifting here — each
    campaign gets its own segregated, independently verifiable deposit UA under
    the one master key. Depends on M2, so it slots after it.

---

## Deploy

Web tier on **Vercel**, the dispenser **worker** on a persistent host
(Railway/Render/Fly), shared **Turso** DB. A push to `main` runs the CI gate
(typecheck + tests + build) and deploys. Full walkthrough — env matrix, secrets,
worker host, and the mock→zallet caveat — in [`docs/deploy.md`](docs/deploy.md).

## Configuration

| Env | Meaning |
|---|---|
| `TURSO_DATABASE_URL` | `file:local.db` for dev; a Turso URL in prod |
| `TURSO_AUTH_TOKEN` | Turso token (prod) |
| `WALLET_BACKEND` | `mock` (default) · `zallet` (Z3) · `zingolib` |
| `WALLET_NETWORK` | `regtest` · `testnet` · `mainnet` |
| `ZALLET_RPC_URL` | Zallet JSON-RPC endpoint (zallet backend) |
| `ZALLET_RPC_USER` / `ZALLET_RPC_PASSWORD` | Zallet RPC auth |
| `HASH_SALT` | salt for hashing addresses/IPs — **change this** |
| `ADMIN_TOKEN` | guards admin endpoints (MVP) — **change this** |
| `TURNSTILE_SECRET` | Cloudflare Turnstile secret (public-pool captcha; blank = off) |
| `NEXT_PUBLIC_TURNSTILE_SITEKEY` | Turnstile site key (client widget) |

## License

MIT (placeholder — set what you want before publishing).
