import { createClient, type Client } from "@libsql/client";
import { config } from "./config";

let _client: Client | null = null;

export function db(): Client {
  if (!_client) {
    _client = createClient({
      url: config.db.url,
      authToken: config.db.authToken,
    });
  }
  return _client;
}

// Convenience: unix seconds
export const now = () => Math.floor(Date.now() / 1000);
