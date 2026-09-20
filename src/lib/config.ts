export const config = {
  db: {
    url: process.env.TURSO_DATABASE_URL || "file:local.db",
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  },
  wallet: {
    backend: (process.env.WALLET_BACKEND || "mock") as "mock" | "zallet" | "zingolib",
    network: (process.env.WALLET_NETWORK || "regtest") as "regtest" | "testnet" | "mainnet",
    zalletRpcUrl: process.env.ZALLET_RPC_URL || "http://localhost:8232",
    rpcUser: process.env.ZALLET_RPC_USER || "",
    rpcPassword: process.env.ZALLET_RPC_PASSWORD || "",
  },
  security: {
    hashSalt: process.env.HASH_SALT || "insecure-dev-salt",
    adminToken: process.env.ADMIN_TOKEN || "dev-admin-token",
    turnstileSecret: process.env.TURNSTILE_SECRET || "",
  },
};
