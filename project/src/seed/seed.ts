// Rumbo · Seed loader — inserts data.ts content into Neon.
// Run via: npx tsx src/seed/seed.ts (from project/)

import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import fs from "fs";
import path from "path";
import {
  zones,
  transferMatrix,
  providers,
  experiences,
  lodging,
  personalization,
} from "./data";

neonConfig.webSocketConstructor = ws;

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

async function seed() {
  loadEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set. Create project/.env.local with your Neon connection string.");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    console.log("Clearing existing seed data...");
    await client.query(
      "TRUNCATE order_items, orders, client_requests, provider_personalization, lodging, experiences, providers, transfer_matrix, zones RESTART IDENTITY CASCADE"
    );

    console.log(`Inserting ${zones.length} zones...`);
    for (const z of zones) {
      await client.query(
        "INSERT INTO zones (id, name, region) VALUES ($1, $2, $3)",
        [z.id, z.name, z.region]
      );
    }

    console.log(`Inserting ${transferMatrix.length} transfer matrix rows...`);
    for (const t of transferMatrix) {
      await client.query(
        "INSERT INTO transfer_matrix (from_zone, to_zone, minutes) VALUES ($1, $2, $3)",
        [t.from_zone, t.to_zone, t.minutes]
      );
    }

    console.log(`Inserting ${providers.length} providers...`);
    for (const p of providers) {
      await client.query(
        `INSERT INTO providers (id, name, zone_id, provider_type, confirmation_mode, reliability_score, base_popularity)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [p.id, p.name, p.zone_id, p.provider_type, p.confirmation_mode, p.reliability_score, p.base_popularity]
      );
    }

    console.log(`Inserting ${experiences.length} experiences...`);
    for (const e of experiences) {
      await client.query(
        `INSERT INTO experiences (id, provider_id, name, category, zone_id, duration_min, open_days, open_from, open_to, net_price, capacity_per_slot, dependency)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [e.id, e.provider_id, e.name, e.category, e.zone_id, e.duration_min, e.open_days, e.open_from, e.open_to, e.net_price, e.capacity_per_slot, e.dependency]
      );
    }

    console.log(`Inserting ${lodging.length} lodging options...`);
    for (const l of lodging) {
      await client.query(
        `INSERT INTO lodging (id, name, zone_id, tier, net_price_per_night, capacity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [l.id, l.name, l.zone_id, l.tier, l.net_price_per_night, l.capacity]
      );
    }

    console.log(`Inserting ${personalization.length} provider personalization rows...`);
    for (const p of personalization) {
      await client.query(
        `INSERT INTO provider_personalization (provider_id, special_occasions, dietary_options, privacy_options, extras_on_request)
         VALUES ($1, $2, $3, $4, $5)`,
        [p.provider_id, p.special_occasions, p.dietary_options, p.privacy_options, p.extras_on_request]
      );
    }

    console.log("Seed complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
