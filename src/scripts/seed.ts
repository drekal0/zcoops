import "dotenv/config";
import { createPool } from "@/domain/pools";
import { generateCodes } from "@/domain/codes";

(async () => {
  const pool = await createPool({
    name: "ETHSafari 2026 — Zcash Booth",
    owner: "drekal0",
    amountPerClaim: "0.01",
    maxClaims: 200,
    cooldownSeconds: 0,
    claimMode: "code",
  });
  const codes = await generateCodes(pool.id, 10);
  console.log("Seeded pool:", pool.id);
  console.log("Claim page: /pools/" + pool.id);
  console.log("Admin page: /pools/" + pool.id + "/admin");
  console.log("Sample codes:", codes.join(", "));
  process.exit(0);
})();
