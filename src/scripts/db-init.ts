import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { db } from "@/lib/db";

(async () => {
  const schema = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");
  const statements = schema.split(";").map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await db().execute(stmt);
  }
  console.log(`[db:init] applied ${statements.length} statements to ${process.env.TURSO_DATABASE_URL}`);
  process.exit(0);
})();
