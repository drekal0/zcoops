-- zcoops schema (libSQL / SQLite dialect)

CREATE TABLE IF NOT EXISTS pools (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  owner             TEXT NOT NULL,              -- organizer handle/email (MVP)
  kind              TEXT NOT NULL DEFAULT 'distribution', -- distribution (claim pool) | collection (crowdfund, M4)
  network           TEXT NOT NULL,              -- regtest | testnet | mainnet
  deposit_address   TEXT,                        -- per-pool deposit UA, NULL until the worker provisions it
  wallet_ref        TEXT,                        -- opaque backend handle (Zallet account id)
  provision_error   TEXT,                        -- set if worker provisioning fails
  amount_per_claim  TEXT NOT NULL,              -- ZEC, stored as string to avoid float drift
  max_claims        INTEGER NOT NULL,
  cooldown_seconds  INTEGER NOT NULL DEFAULT 0, -- per-claimant cooldown, public mode
  claim_mode        TEXT NOT NULL DEFAULT 'public', -- public | code
  status            TEXT NOT NULL DEFAULT 'provisioning', -- provisioning | provisioning_inflight | active | paused | closed | provision_failed
  expires_at        INTEGER,                    -- unix seconds, nullable
  created_at        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS claims (
  id            TEXT PRIMARY KEY,
  pool_id       TEXT NOT NULL REFERENCES pools(id),
  dest_hash     TEXT NOT NULL,                  -- hash(dest_address + salt), never store raw long-term
  dest_address  TEXT,                           -- kept only until sent, then nulled by worker
  ip_hash       TEXT NOT NULL,                  -- hash(ip + salt)
  amount        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued', -- queued | sent | failed
  txid          TEXT,
  error         TEXT,
  created_at    INTEGER NOT NULL,
  sent_at       INTEGER
);

CREATE TABLE IF NOT EXISTS claim_codes (
  code         TEXT PRIMARY KEY,
  pool_id      TEXT NOT NULL REFERENCES pools(id),
  redeemed_by  TEXT,                            -- claim_id that consumed it
  redeemed_at  INTEGER,
  created_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_claims_pool        ON claims(pool_id);
CREATE INDEX IF NOT EXISTS idx_claims_status      ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_pool_ip     ON claims(pool_id, ip_hash);
CREATE INDEX IF NOT EXISTS idx_codes_pool         ON claim_codes(pool_id);
