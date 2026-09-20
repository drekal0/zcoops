import { createHash, randomBytes } from "crypto";
import type { WalletAdapter, Network, DepositInfo, DispenseRequest, DispenseResult } from "./adapter";

/**
 * MockAdapter — no chain. Deterministic fake accounts/addresses, fake txids.
 * Lets you build and test the entire product (pools, codes, queue, dashboard)
 * with zero infrastructure. Default backend.
 */
export class MockAdapter implements WalletAdapter {
  readonly network: Network;
  private balances = new Map<string, number>();

  constructor(network: Network = "regtest") {
    this.network = network;
  }

  async deriveDepositAddress(poolId: string): Promise<DepositInfo> {
    const h = createHash("sha256").update("mock:" + poolId).digest("hex").slice(0, 40);
    const address = `u1mock${h}`;
    const ref = poolId; // mock uses the pool id as its account handle
    if (!this.balances.has(ref)) this.balances.set(ref, 100); // pretend pre-funded
    return { address, ref };
  }

  async getPoolBalance(ref: string): Promise<string> {
    return (this.balances.get(ref) ?? 0).toFixed(8);
  }

  async send(_req: DispenseRequest): Promise<DispenseResult> {
    await new Promise((r) => setTimeout(r, 400)); // simulate broadcast latency
    return { txid: "mock" + randomBytes(24).toString("hex") };
  }
}
