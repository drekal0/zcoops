import type { WalletAdapter } from "./adapter";
import { MockAdapter } from "./mock";
import { ZalletAdapter } from "./zallet";
import { ZingolibAdapter } from "./zingolib";
import { config } from "@/lib/config";

let _wallet: WalletAdapter | null = null;

export function wallet(): WalletAdapter {
  if (_wallet) return _wallet;
  const net = config.wallet.network;
  switch (config.wallet.backend) {
    case "zallet":
      _wallet = new ZalletAdapter(net);
      break;
    case "zingolib":
      _wallet = new ZingolibAdapter(net);
      break;
    case "mock":
    default:
      _wallet = new MockAdapter(net);
  }
  return _wallet;
}

export type { WalletAdapter } from "./adapter";
