import type { WalletAdapter, Network, DepositInfo, DispenseRequest, DispenseResult } from "./adapter";

/**
 * ZingolibAdapter — alternative backend (STUB). Lightwallet client (zingolib via
 * neon) syncing against a Zaino gRPC endpoint. More battle-tested diversified/
 * account derivation than beta Zallet, at the cost of a Rust/neon build and a
 * sync burden inside the app. Same interface, same accounts-per-pool model.
 * Prefer the Zallet adapter unless you specifically need this.
 */
export class ZingolibAdapter implements WalletAdapter {
  readonly network: Network;
  constructor(network: Network = "mainnet") {
    this.network = network;
  }
  async deriveDepositAddress(_poolId: string): Promise<DepositInfo> {
    throw new Error("ZingolibAdapter not implemented — prefer the zallet backend.");
  }
  async getPoolBalance(_ref: string): Promise<string> {
    throw new Error("ZingolibAdapter not implemented — prefer the zallet backend.");
  }
  async send(_req: DispenseRequest): Promise<DispenseResult> {
    throw new Error("ZingolibAdapter not implemented — prefer the zallet backend.");
  }
}
