// Rumbo · Operator "Providers" section — catalog WRITES.
//
// This is the one operator surface that writes to the live catalog: it inserts
// new supply (experience businesses → providers + experiences; lodging → lodging)
// so it appears in future itineraries. Kept separate from the read-only store.ts.
//
// Coordinates are placed automatically: a new business inherits its zone's
// centroid (the average of existing coords in that zone) plus a small random
// jitter, matching how the seeded catalog was laid out. The operator never
// types lat/lng.
import crypto from "crypto";
import { getPool } from "../db/pool";
import {
  EXPERIENCE_CATEGORIES,
  DEPENDENCIES,
  LODGING_TIERS,
  DAYS,
  type ZoneOption,
} from "./catalog-fields";

export type { ZoneOption };

/** Zones for the location dropdown. */
export async function getZones(): Promise<ZoneOption[]> {
  const pool = getPool();
  const { rows } = await pool.query(`SELECT id, name, region FROM zones ORDER BY region, name`);
  return rows.map((r) => ({ id: r.id, name: r.name, region: r.region }));
}

export interface ExperienceCatalogRow {
  id: string;
  name: string;
  provider_name: string;
  zone_name: string;
  category: string;
  net_price: number;
}
export interface LodgingCatalogRow {
  id: string;
  name: string;
  zone_name: string;
  tier: string;
  net_price_per_night: number;
}

/** The existing supply, shown above the add form so the operator isn't blind. */
export async function getSupplyCatalog(): Promise<{
  experiences: ExperienceCatalogRow[];
  lodging: LodgingCatalogRow[];
}> {
  const pool = getPool();
  const [exp, lodge] = await Promise.all([
    pool.query(
      `SELECT e.id, e.name, e.category, e.net_price,
              p.name AS provider_name, z.name AS zone_name
       FROM experiences e
       JOIN providers p ON p.id = e.provider_id
       JOIN zones z ON z.id = e.zone_id
       ORDER BY z.name, e.name`
    ),
    pool.query(
      `SELECT l.id, l.name, l.tier, l.net_price_per_night, z.name AS zone_name
       FROM lodging l
       JOIN zones z ON z.id = l.zone_id
       ORDER BY z.name, l.name`
    ),
  ]);
  return {
    experiences: exp.rows.map((r) => ({
      id: r.id,
      name: r.name,
      provider_name: r.provider_name,
      zone_name: r.zone_name,
      category: r.category,
      net_price: Number(r.net_price),
    })),
    lodging: lodge.rows.map((r) => ({
      id: r.id,
      name: r.name,
      zone_name: r.zone_name,
      tier: r.tier,
      net_price_per_night: Number(r.net_price_per_night),
    })),
  };
}

/**
 * A zone's centroid = the average of existing coords for providers and lodging
 * in that zone, plus a small random jitter so new pins don't stack. Returns
 * null coords if the zone has no coordinate data yet (the map link degrades
 * gracefully on null).
 */
async function placeInZone(zoneId: string): Promise<{ lat: number | null; lng: number | null }> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT avg(lat) AS lat, avg(lng) AS lng FROM (
       SELECT lat, lng FROM providers WHERE zone_id = $1 AND lat IS NOT NULL
       UNION ALL
       SELECT lat, lng FROM lodging WHERE zone_id = $1 AND lat IS NOT NULL
     ) c`,
    [zoneId]
  );
  const clat = rows[0]?.lat != null ? Number(rows[0].lat) : null;
  const clng = rows[0]?.lng != null ? Number(rows[0].lng) : null;
  if (clat == null || clng == null) return { lat: null, lng: null };
  const jitter = () => Math.round((Math.random() * 2 - 1) * 0.009 * 1e6) / 1e6; // ±~1km
  return {
    lat: Math.round((clat + jitter()) * 1e6) / 1e6,
    lng: Math.round((clng + jitter()) * 1e6) / 1e6,
  };
}

/** kebab slug from a name, for building a text primary key. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/** `<prefix>_<slug>_<rand>` — the short suffix avoids primary-key collisions. */
function makeId(prefix: string, name: string): string {
  const slug = slugify(name) || "item";
  const suffix = crypto.randomBytes(2).toString("hex");
  return `${prefix}_${slug}_${suffix}`;
}

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export interface NewExperienceInput {
  name: string;
  zone_id: string;
  category: string;
  duration_min: number;
  open_days: string[];
  open_from: string;
  open_to: string;
  net_price: number;
  capacity_per_slot: number;
  dependency: string | null;
  provider_type: string;
  confirmation_mode: string;
  reliability_score: number;
  base_popularity: number;
  personalization?: {
    special_occasions?: string;
    dietary_options?: string;
    privacy_options?: string;
    extras_on_request?: string;
  };
}

export interface NewLodgingInput {
  name: string;
  zone_id: string;
  tier: string;
  net_price_per_night: number;
  capacity: number;
}

export type CreateResult = { ok: true; message: string } | { ok: false; message: string };

/**
 * Registers an experience business: a `providers` row plus its `experiences`
 * row (and optional personalization), in one transaction. Validates the engine
 * invariants (valid category/dependency, and open window long enough for the
 * activity) before writing.
 */
export async function createExperienceBusiness(input: NewExperienceInput): Promise<CreateResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Business name is required." };
  if (!input.zone_id) return { ok: false, message: "Please choose a zone." };
  if (!EXPERIENCE_CATEGORIES.includes(input.category as never))
    return { ok: false, message: "Invalid category." };
  if (input.dependency && !DEPENDENCIES.includes(input.dependency as never))
    return { ok: false, message: "Invalid dependency." };
  if (!input.open_days.length) return { ok: false, message: "Select at least one open day." };
  if (!(input.duration_min > 0)) return { ok: false, message: "Duration must be positive." };
  if (!(input.net_price >= 0)) return { ok: false, message: "Price must be zero or more." };
  if (!(input.capacity_per_slot > 0)) return { ok: false, message: "Capacity must be positive." };

  const from = toMinutes(input.open_from);
  const to = toMinutes(input.open_to);
  if (from == null || to == null) return { ok: false, message: "Invalid open/close time." };
  if (to <= from) return { ok: false, message: "Closing time must be after opening time." };
  if (to - from < input.duration_min)
    return {
      ok: false,
      message: "The open window is shorter than the activity duration.",
    };

  const providerId = makeId("prov", name);
  const experienceId = makeId("exp", name);
  const { lat, lng } = await placeInZone(input.zone_id);
  const openDaysCsv = DAYS.filter((d) => input.open_days.includes(d)).join(",");

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO providers
         (id, name, zone_id, provider_type, confirmation_mode, reliability_score, base_popularity, lat, lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        providerId,
        name,
        input.zone_id,
        input.provider_type,
        input.confirmation_mode,
        input.reliability_score,
        input.base_popularity,
        lat,
        lng,
      ]
    );
    await client.query(
      `INSERT INTO experiences
         (id, provider_id, name, category, zone_id, duration_min, open_days, open_from, open_to, net_price, capacity_per_slot, dependency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        experienceId,
        providerId,
        name,
        input.category,
        input.zone_id,
        input.duration_min,
        openDaysCsv,
        input.open_from,
        input.open_to,
        input.net_price,
        input.capacity_per_slot,
        input.dependency,
      ]
    );
    const p = input.personalization;
    if (p && (p.special_occasions || p.dietary_options || p.privacy_options || p.extras_on_request)) {
      await client.query(
        `INSERT INTO provider_personalization
           (provider_id, special_occasions, dietary_options, privacy_options, extras_on_request)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          providerId,
          p.special_occasions || null,
          p.dietary_options || null,
          p.privacy_options || null,
          p.extras_on_request || null,
        ]
      );
    }
    await client.query("COMMIT");
    return { ok: true, message: `Added “${name}” to the catalog.` };
  } catch (err) {
    await client.query("ROLLBACK");
    return { ok: false, message: `Could not save: ${(err as Error).message}` };
  } finally {
    client.release();
  }
}

/** Registers a lodging (one row in the lodging table). */
export async function createLodging(input: NewLodgingInput): Promise<CreateResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Lodging name is required." };
  if (!input.zone_id) return { ok: false, message: "Please choose a zone." };
  if (!LODGING_TIERS.includes(input.tier as never))
    return { ok: false, message: "Invalid tier." };
  if (!(input.net_price_per_night >= 0))
    return { ok: false, message: "Price must be zero or more." };
  if (!(input.capacity > 0)) return { ok: false, message: "Capacity must be positive." };

  const id = makeId("lodge", name);
  const { lat, lng } = await placeInZone(input.zone_id);

  const pool = getPool();
  try {
    await pool.query(
      `INSERT INTO lodging (id, name, zone_id, tier, net_price_per_night, capacity, lat, lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, name, input.zone_id, input.tier, input.net_price_per_night, input.capacity, lat, lng]
    );
    return { ok: true, message: `Added “${name}” to the catalog.` };
  } catch (err) {
    return { ok: false, message: `Could not save: ${(err as Error).message}` };
  }
}
