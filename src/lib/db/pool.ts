// Rumbo · shared Neon pool for runtime (non-migration) DB access.
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import fs from "fs";
import path from "path";

neonConfig.webSocketConstructor = ws;

function loadEnv() {
  if (process.env.DATABASE_URL) return;
  // On Vercel (and any CI) env vars are injected directly — skip the fs-based
  // .env fallback entirely so Next's build tracer never has to statically
  // analyze this file's fs/path usage.
  if (process.env.VERCEL || process.env.CI) return;
  for (const file of [".env.local", ".env"]) {
    const p = path.resolve(/* turbopackIgnore: true */ process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/);
      if (m) {
        process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, "").trim();
        return;
      }
    }
  }
}

let pool: Pool | null = null;

/** Lazily-created singleton Pool. Reads DATABASE_URL from env (or .env.local/.env). */
export function getPool(): Pool {
  if (pool) return pool;
  loadEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set. Create project/.env.local with your Neon connection string.");
  }
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}
