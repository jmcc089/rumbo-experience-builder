// Rumbo · SBI-10: presentation-layer enrichment for the proposals page.
//
// The engine's ItinerarySnapshot carries only IDs (experience_id, lodging_id,
// zone_id) plus scheduled times and the marked-up client_total. The client
// portal needs human-readable names, categories and a per-day calendar date.
// This module resolves those from the catalog and derives a deterministic
// "character name" + summary for each of the three distinct proposals.
//
// It NEVER exposes provider net prices or the markup — only client_total.

import { getPool } from "../db/pool";
import type {
  Dependency,
  ExperienceCategory,
  ItinerarySnapshot,
  ItineraryScores,
  LodgingTier,
} from "../types";
import { getProposals } from "./requests";
import { getRequestByToken } from "./store";

/* ── View model ─────────────────────────────────────────────────────────── */

export interface EnrichedExperience {
  name: string;
  category: ExperienceCategory;
  start_time: string; // 'HH:MM'
  end_time: string; // 'HH:MM'
  duration_min: number;
  dependency: Dependency;
}

export interface EnrichedDay {
  day_index: number; // 1-based
  date: string; // 'YYYY-MM-DD'
  zone_name: string;
  lodging_name: string;
  lodging_tier: LodgingTier;
  transfer_in_minutes: number;
  experiences: EnrichedExperience[];
}

export interface EnrichedProposal {
  index: number; // 0-based index into the stored proposals (== confirmAndPay chosenIndex)
  title: string; // derived character name, e.g. "Volcanoes & Coast"
  summary: string; // one-line distinctness summary
  categories: ExperienceCategory[]; // distinct interest tags, most-present first
  zones: string[]; // distinct zone names in visiting order
  nights: number;
  client_total: number; // marked-up, all-in — the only price ever shown
  days: EnrichedDay[];
  scores: ItineraryScores;
}

export type ProposalsPageStatus =
  | "ready"
  | "paid"
  | "expired"
  | "not_ready"
  | "not_found";

export interface ProposalsPageView {
  status: ProposalsPageStatus;
  proposals?: EnrichedProposal[]; // present when status === "ready"
  chosen?: EnrichedProposal; // present when status === "paid" (the booked itinerary)
  expiresAt?: string; // ISO — drives the hold countdown
  travelers?: number;
}

/* ── Catalog lookup ─────────────────────────────────────────────────────── */

interface CatalogMaps {
  exp: Map<string, { name: string; category: ExperienceCategory; duration_min: number; dependency: Dependency }>;
  lodging: Map<string, { name: string; tier: LodgingTier }>;
  zone: Map<string, string>;
}

async function loadCatalog(snapshots: ItinerarySnapshot[]): Promise<CatalogMaps> {
  const experienceIds = new Set<string>();
  const lodgingIds = new Set<string>();
  const zoneIds = new Set<string>();
  for (const snap of snapshots) {
    for (const day of snap.days) {
      lodgingIds.add(day.lodging_id);
      zoneIds.add(day.zone_id);
      for (const exp of day.experiences) experienceIds.add(exp.experience_id);
    }
  }

  const pool = getPool();
  const [expRes, lodgingRes, zoneRes] = await Promise.all([
    experienceIds.size
      ? pool.query(
          `SELECT id, name, category, duration_min, dependency FROM experiences WHERE id = ANY($1)`,
          [Array.from(experienceIds)]
        )
      : Promise.resolve({ rows: [] }),
    lodgingIds.size
      ? pool.query(`SELECT id, name, tier FROM lodging WHERE id = ANY($1)`, [Array.from(lodgingIds)])
      : Promise.resolve({ rows: [] }),
    zoneIds.size
      ? pool.query(`SELECT id, name FROM zones WHERE id = ANY($1)`, [Array.from(zoneIds)])
      : Promise.resolve({ rows: [] }),
  ]);

  return {
    exp: new Map(
      expRes.rows.map((r) => [
        r.id,
        {
          name: r.name,
          category: r.category as ExperienceCategory,
          duration_min: Number(r.duration_min),
          dependency: (r.dependency ?? null) as Dependency,
        },
      ])
    ),
    lodging: new Map(lodgingRes.rows.map((r) => [r.id, { name: r.name, tier: r.tier as LodgingTier }])),
    zone: new Map(zoneRes.rows.map((r) => [r.id, r.name])),
  };
}

/* ── Deterministic proposal identity (character name + summary) ──────────── */

// Evocative nouns for the two most-present categories. Deterministic mapping —
// no LLM. Summarizes real itinerary content, never invents it.
const CATEGORY_WORD: Record<ExperienceCategory, string> = {
  nature: "Volcanoes",
  adventure: "Adventure",
  beach: "Coast",
  culture: "Colonial",
  coffee: "Coffee",
  food: "Flavors",
};

// Fixed order breaks frequency ties so naming is stable across renders.
const CATEGORY_ORDER: ExperienceCategory[] = ["nature", "coffee", "culture", "beach", "adventure", "food"];

function distinctCategoriesByPresence(days: EnrichedDay[]): ExperienceCategory[] {
  const count = new Map<ExperienceCategory, number>();
  for (const day of days) {
    for (const exp of day.experiences) {
      count.set(exp.category, (count.get(exp.category) ?? 0) + 1);
    }
  }
  return [...count.keys()].sort((a, b) => {
    const diff = (count.get(b) ?? 0) - (count.get(a) ?? 0);
    if (diff !== 0) return diff;
    return CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b);
  });
}

function deriveSummary(zones: string[], nights: number): string {
  const route = zones.length > 1 ? `${zones[0]} → ${zones[zones.length - 1]}` : zones[0] ?? "El Salvador";
  const nightLabel = `${nights} ${nights === 1 ? "night" : "nights"}`;
  return zones.length > 1 ? `${nightLabel} · ${zones.length} regions, ${route}` : `${nightLabel} based in ${route}`;
}

// Candidate category-pair positions, tried in order, so colliding proposals
// fall through to a still-thematic but distinct two-word combination.
const TITLE_PAIRS: Array<[number, number]> = [
  [0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [2, 3],
];

/**
 * Assigns a distinct "character name" to each proposal in the set. Base name is
 * the two most-present categories; on collision it walks to the next unused
 * category pair so no two of the three cards share a title.
 */
function assignDistinctTitles(proposals: EnrichedProposal[]): void {
  const used = new Set<string>();
  for (const p of proposals) {
    const cats = p.categories;
    let title = "";
    for (const [i, j] of TITLE_PAIRS) {
      if (cats[i] && cats[j]) {
        const candidate = `${CATEGORY_WORD[cats[i]]} & ${CATEGORY_WORD[cats[j]]}`;
        if (!used.has(candidate)) {
          title = candidate;
          break;
        }
      }
    }
    if (!title) {
      // Single-category or all pairs taken — fall back to a unique route name.
      const base = cats[0] ? `The ${CATEGORY_WORD[cats[0]]} Route` : "The Full Circuit";
      title = base;
      let n = 2;
      while (used.has(title)) title = `${base} ${n++}`;
    }
    used.add(title);
    p.title = title;
  }
}

/* ── Date helpers ───────────────────────────────────────────────────────── */

/** Adds whole days to a 'YYYY-MM-DD' date without timezone drift. */
function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/* ── Enrichment ─────────────────────────────────────────────────────────── */

function enrichOne(snap: ItinerarySnapshot, index: number, arrivalDate: string, catalog: CatalogMaps): EnrichedProposal {
  const days: EnrichedDay[] = snap.days.map((day) => ({
    day_index: day.day_index,
    date: addDays(arrivalDate, day.day_index - 1),
    zone_name: catalog.zone.get(day.zone_id) ?? day.zone_id,
    lodging_name: catalog.lodging.get(day.lodging_id)?.name ?? day.lodging_id,
    lodging_tier: catalog.lodging.get(day.lodging_id)?.tier ?? "comfort",
    transfer_in_minutes: day.transfer_in_minutes,
    experiences: day.experiences.map((exp) => {
      const meta = catalog.exp.get(exp.experience_id);
      return {
        name: meta?.name ?? exp.experience_id,
        category: meta?.category ?? "culture",
        start_time: exp.start_time,
        end_time: exp.end_time,
        duration_min: meta?.duration_min ?? 0,
        dependency: meta?.dependency ?? null,
      };
    }),
  }));

  // Distinct zones in visiting order.
  const zones: string[] = [];
  for (const day of days) {
    if (zones[zones.length - 1] !== day.zone_name) zones.push(day.zone_name);
  }

  const categories = distinctCategoriesByPresence(days);
  const nights = days.length;

  return {
    index,
    title: "", // assigned by assignDistinctTitles once the full set is known
    summary: deriveSummary(zones, nights),
    categories,
    zones,
    nights,
    client_total: snap.client_total,
    days,
    scores: snap.scores,
  };
}

/**
 * Loads and enriches the proposals for a token. Delegates to getProposals(),
 * which starts the 15-minute hold on first view. Handles the already-paid case
 * by returning the booked itinerary so a reload after payment shows the
 * confirmation rather than the live options.
 */
export async function getProposalsPageView(token: string): Promise<ProposalsPageView> {
  const view = await getProposals(token);
  const request = await getRequestByToken(token);

  if (view.status === "not_found" || !request) return { status: "not_found" };
  if (view.status === "expired") return { status: "expired" };
  if (view.status === "not_ready") return { status: "not_ready" };

  // status === "ready": proposals are present. Distinguish paid vs. live.
  const snapshots = view.proposals ?? [];

  if (request.status === "paid") {
    const chosen = await loadPaidItinerary(request.id, request.arrival_date);
    return { status: "paid", chosen: chosen ?? undefined, travelers: request.travelers };
  }

  const catalog = await loadCatalog(snapshots);
  const proposals = snapshots.map((snap, i) => enrichOne(snap, i, request.arrival_date, catalog));
  assignDistinctTitles(proposals);

  return {
    status: "ready",
    proposals,
    expiresAt: view.expiresAt,
    travelers: request.travelers,
  };
}

/** Loads the itinerary that was actually booked (for the reload-after-pay case). */
async function loadPaidItinerary(requestId: string, arrivalDate: string): Promise<EnrichedProposal | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT chosen_itinerary_json FROM orders WHERE request_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [requestId]
  );
  if (!rows[0]) return null;
  const snap = rows[0].chosen_itinerary_json as ItinerarySnapshot;
  const catalog = await loadCatalog([snap]);
  const proposal = enrichOne(snap, 0, arrivalDate, catalog);
  assignDistinctTitles([proposal]);
  return proposal;
}

/** Lightweight status read that does NOT start the hold — for the status page poll. */
export async function getRequestStatus(
  token: string
): Promise<{ status: "building" | "proposals_ready" | "paid" | "expired" | "not_found" }> {
  const request = await getRequestByToken(token);
  if (!request) return { status: "not_found" };
  return { status: request.status };
}
