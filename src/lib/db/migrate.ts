import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import fs from "fs";
import path from "path";

neonConfig.webSocketConstructor = ws;

// Load DATABASE_URL from .env.local (or .env) if not already in the environment
function loadEnv() {
  if (process.env.DATABASE_URL) return;
  for (const file of [".env.local", ".env"]) {
    const p = path.resolve(process.cwd(), file);
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

async function migrate() {
  loadEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set. Create project/.env.local with your Neon connection string.");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ddl = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  const client = await pool.connect();
  try {
    await client.query(ddl);
    console.log("Migration complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
