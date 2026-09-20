/**
 * WalletAdapter — the seam between the app and Zcash.
 *
 * Everything above this interface (pools, claims, the queue, analytics) is
 * chain-agnostic and unit-testable against the MockAdapter. Everything
 * chain-specific lives in an implementation. Transitioning from the mock to
 * your own synced node + Zallet is a config change (env only), not a rewrite.
 *
 * Accounting model (segregated per pool):
 *   ONE wallet seed, custodied by the operator. Each pool is its own ZIP-32
 *   ACCOUNT under that seed — its own unified address (deposit address), its own
 *   on-chain balance, and its own spend authority, all recoverable from the one
 *   seed. Accounts (not diversified addresses) are what actually keep one pool's
 *   funds from mixing with another's. `ref` below is that opaque backend handle
 *   (the account id for Zallet; the pool id for the mock).
 */

export type Network = "regtest" | "testnet" | "mainnet";

/** What the app persists per pool to address the backend later. */
export interface DepositInfo {
  address: string; // the pool's deposit UA (shown/funded)
  ref: string;     // opaque backend handle (Zallet account id, etc.)
}

export interface DispenseRequest {
  poolId: string;
  fromRef: string;     // the pool's backend ref (which account to spend from)
  fromAddress: string; // the pool's deposit address
  toAddress: string;
  amount: string;      // ZEC, decimal string
}

export interface DispenseResult {
  txid: string;
}

export interface WalletAdapter {
  readonly network: Network;

  /** Provision a pool's account and return its deposit address + backend ref. */
  deriveDepositAddress(poolId: string): Promise<DepositInfo>;

  /** Confirmed balance for a pool, in ZEC, addressed by its backend ref. */
  getPoolBalance(ref: string): Promise<string>;

  /**
   * Send one claim. The dispenser worker guarantees single-flight (one send at
   * a time per wallet) so adapters need NOT handle concurrency/note races.
   */
  send(req: DispenseRequest): Promise<DispenseResult>;
}
