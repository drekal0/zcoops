# Deploying zcoops

Three moving parts, one database:

```
                 ┌───────────────────────────┐
   push to main ─┤ GitHub Actions (ci.yml)    │
                 │  typecheck · tests · build │
                 └───────┬───────────┬────────┘
                         │ deploy    │ build+push image
                         ▼           ▼
                 ┌──────────────┐  ┌──────────────────────┐
   claimants ───▶│ Vercel       │  │ Worker host          │
   organizers    │ (Next.js:    │  │ (Railway/Render/Fly) │
                 │  UI + API)   │  │  dispenser, holds     │
                 └──────┬───────┘  │  wallet access)       │
                        │          └──────────┬────────────┘
                        │  read/write         │ drain queue, send
                        ▼                     ▼
                   ┌──────────────────────────────┐
                   │ Turso (libSQL) — shared state │
                   └──────────────────────────────┘
```

- **Vercel** serves the app (UI + `/api/*`). Serverless — fine for enqueueing
  claims and reading stats.
- **Worker host** runs the dispenser (`npm run worker`), a long-running loop that
  drains `queued` claims one at a time. This **cannot** live on Vercel; it needs
  a persistent process. It's the only piece that talks to the wallet.
- **Turso** is the shared DB both connect to.

## 1. Database (Turso)

```bash
turso db create zcoops
turso db show zcoops --url          # -> TURSO_DATABASE_URL
turso db tokens create zcoops       # -> TURSO_AUTH_TOKEN
# apply the schema once:
TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:init
```

## 2. GitHub secrets

Set these in the repo (Settings → Secrets and variables → Actions):

| Secret | For |
|---|---|
| `VERCEL_TOKEN` | Vercel CLI auth |
| `VERCEL_ORG_ID` | from `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | same |

`GITHUB_TOKEN` (for pushing the worker image to GHCR) is provided automatically.

The `deploy-web` and `worker-image` jobs only run once you opt in: set a repo
**variable** `DEPLOY_ENABLED=true` (Settings → Secrets and variables → Actions →
Variables). Until then, pushes just run the `ci` gate — so your first push is green.

> Prefer zero-config? Instead of the `deploy-web` job, connect the repo in the
> Vercel dashboard — Vercel auto-deploys every push and you can drop that job.
> The `ci` gate and `worker-image` job still earn their keep.

## 3. Vercel env vars

Set in the Vercel project (Settings → Environment Variables):

| Var | Notes |
|---|---|
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | same DB as the worker |
| `HASH_SALT` | long random string |
| `ADMIN_TOKEN` | guards admin endpoints |
| `TURNSTILE_SECRET`, `NEXT_PUBLIC_TURNSTILE_SITEKEY` | public-pool captcha (optional) |
| `WALLET_BACKEND` | `mock` for now (see caveat below) |
| `WALLET_NETWORK` | `regtest` / `testnet` / `mainnet` |

## 4. Worker host (Railway / Render / Fly)

Deploy `Dockerfile.worker` — either point the host at the repo (it builds the
Dockerfile) or pull `ghcr.io/OWNER/REPO-worker:latest` that CI publishes.

Set the worker's env vars (dashboard):

| Var | Notes |
|---|---|
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | same DB as Vercel |
| `WALLET_BACKEND` | `mock`, or `zallet` once your node is up |
| `WALLET_NETWORK` | matches Vercel |
| `ZALLET_RPC_URL`, `ZALLET_RPC_USER`, `ZALLET_RPC_PASSWORD` | your Zallet (worker-only) |

Only the worker gets the Zallet credentials — Vercel never reaches your node.

## 5. Push

`git push origin main` → CI runs → on green, Vercel gets the web tier and GHCR
gets the worker image. Connect the worker host once and you have a live URL.

---

## Wallet isolation (done)

Pool provisioning runs on the **worker**, not the web tier. `createPool` (on
Vercel) only writes a `provisioning` row — no wallet call — and the worker
derives the deposit account/address and flips the pool to `active`. So **only the
worker needs `ZALLET_RPC_*`**; Vercel never reaches your node. Flipping
`WALLET_BACKEND=mock -> zallet` on the worker is all it takes. See
`docs/wallet-z3.md`.
