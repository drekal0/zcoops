import { readFileSync } from "fs";
import { join } from "path";
import { db } from "@/lib/db";
import { createPool, verifyManageKey, toPublicPool } from "@/domain/pools";

(async () => {
  const schema = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");
  for (const s of schema.split(";").map(x => x.trim()).filter(Boolean)) await db().execute(s);

  const pool = await createPool({ name: "Auth Test", owner: "dre", amountPerClaim: "0.01", maxClaims: 5, claimMode: "code" });
  let pass = 0, fail = 0;
  const t = (n: string, c: boolean) => c ? pass++ : (fail++, console.log("  ✗", n));

  t("correct manage key verifies", await verifyManageKey(pool.id, pool.manage_key));
  t("wrong manage key rejected", !(await verifyManageKey(pool.id, "wrong-key-xxxxxxxxxxxxxxxxxx")));
  t("empty key rejected", !(await verifyManageKey(pool.id, "")));
  t("key for unknown pool rejected", !(await verifyManageKey("pool_nope", pool.manage_key)));

  const pub = toPublicPool(pool) as any;
  t("public projection has no manage_key", pub.manage_key === undefined);
  t("public projection has no deposit_address", pub.deposit_address === undefined);
  t("public projection has no owner", pub.owner === undefined);
  t("public projection keeps name", pub.name === "Auth Test");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
