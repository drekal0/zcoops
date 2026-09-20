import type { WalletAdapter, Network, DepositInfo, DispenseRequest, DispenseResult } from "./adapter";
import { config } from "@/lib/config";

/**
 * ZalletAdapter — the real backend. Talks to a Zallet wallet over JSON-RPC.
 *
 * Designed for a config-only transition: today WALLET_BACKEND=mock; when your
 * Zebra node + Zallet are synced, set WALLET_BACKEND=zallet and point
 * ZALLET_RPC_URL/USER/PASSWORD at your wallet. No code changes — zcoops stays
 * pure TypeScript and never holds keys; Zallet does.
 *
 * Model: one account per pool (ZIP-32) under Zallet's single seed. Provisioning
 * a pool creates an account and its unified address; balance/sends are addressed
 * by that account. See adapter.ts "Accounting model".
 *
 * BETA NOTE: Zallet's RPC surface is still stabilizing. The exact method names
 * live in RPC below — if your Zallet build names them differently, this is the
 * only place to change. Verify against your Zallet's `help` before first use.
 */

// Centralized RPC method names — the single place to adjust for your build.
const RPC = {
  newAccount: "z_getnewaccount",
  addressForAccount: "z_getaddressforaccount",
  balanceForAccount: "z_getbalanceforaccount",
  sendMany: "z_sendmany",
  operationResult: "z_getoperationresult",
} as const;

type JsonRpcResp<T> = { result: T; error: { code: number; message: string } | null; id: string };

export class ZalletAdapter implements WalletAdapter {
  readonly network: Network;
  private url: string;
  private authHeader?: string;

  constructor(network: Network = "testnet") {
    this.network = network;
    this.url = config.wallet.zalletRpcUrl;
    const { rpcUser, rpcPassword } = config.wallet;
    if (rpcUser) {
      this.authHeader = "Basic " + Buffer.from(`${rpcUser}:${rpcPassword}`).toString("base64");
    }
  }

  private async call<T>(method: string, params: unknown[] = []): Promise<T> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.authHeader ? { Authorization: this.authHeader } : {}),
      },
      body: JSON.stringify({ jsonrpc: "1.0", id: "zcoops", method, params }),
    });
    if (!res.ok) throw new Error(`Zallet RPC ${method} HTTP ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as JsonRpcResp<T>;
    if (body.error) throw new Error(`Zallet RPC ${method}: ${body.error.message}`);
    return body.result;
  }

  async deriveDepositAddress(_poolId: string): Promise<DepositInfo> {
    // New ZIP-32 account under the wallet's single seed → segregated funds.
    const acct = await this.call<{ account: number } | number>(RPC.newAccount, []);
    const account = typeof acct === "number" ? acct : acct.account;
    // Unified address for that account (Orchard+Sapling receivers).
    const ua = await this.call<{ address: string } | string>(RPC.addressForAccount, [
      account,
      ["orchard", "sapling"],
    ]);
    const address = typeof ua === "string" ? ua : ua.address;
    return { address, ref: String(account) };
  }

  async getPoolBalance(ref: string): Promise<string> {
    // minconf=1 confirmed balance for the pool's account.
    const bal = await this.call<{ pools?: unknown; balance?: number } | number>(
      RPC.balanceForAccount,
      [Number(ref), 1]
    );
    if (typeof bal === "number") return bal.toFixed(8);
    // account balance may come back structured; sum spendable if so.
    if (typeof bal?.balance === "number") return bal.balance.toFixed(8);
    return "0.00000000";
  }

  async send(req: DispenseRequest): Promise<DispenseResult> {
    // Spend from the pool's own account (via its deposit UA) to the claimant.
    const opid = await this.call<string>(RPC.sendMany, [
      req.fromAddress,
      [{ address: req.toAddress, amount: Number(req.amount) }],
      1,        // minconf
      null,     // fee: let the wallet pick a ZIP-317 conformant fee
    ]);
    return { txid: await this.awaitOperation(opid) };
  }

  // z_sendmany is async: it returns an operation id; poll until it resolves.
  private async awaitOperation(opid: string, timeoutMs = 120_000): Promise<string> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const results = await this.call<Array<any>>(RPC.operationResult, [[opid]]);
      const op = results?.[0];
      if (op) {
        if (op.status === "success") {
          const txid = op.result?.txid;
          if (!txid) throw new Error("Zallet op succeeded but returned no txid");
          return txid;
        }
        if (op.status === "failed") {
          throw new Error(`Zallet send failed: ${op.error?.message ?? "unknown"}`);
        }
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw new Error("Zallet send timed out waiting for operation to resolve");
  }
}
