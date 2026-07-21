// Rumbo · Shared TypeScript types (mirrors DB schema)
// net_price on Experience is PER PERSON.
// open_days is a CSV string: e.g. 'mon,tue,wed,thu,fri,sat,sun'

export type Region = "west" | "central" | "east";

export interface Zone {
  id: string;
  name: string;
  region: Region;
}

export interface TransferMatrix {
  from_zone: string;
  to_zone: string;
  minutes: number;
}

export type ProviderType = "formal" | "informal";
export type ConfirmationMode = "instant" | "on_request";

export interface Provider {
  id: string;
  name: string;
  zone_id: string;
  provider_type: ProviderType;
  confirmation_mode: ConfirmationMode;
  reliability_score: number; // 0–1
  base_popularity: number;   // 0–1
}

export type ExperienceCategory =
  | "nature"
  | "food"
  | "culture"
  | "beach"
  | "adventure"
  | "coffee";

export type Dependency =
  | "sunrise_only"
  | "tide_dependent"
  | "weather_sensitive"
  | null;

export interface Experience {
  id: string;
  provider_id: string;
  name: string;
  category: ExperienceCategory;
  zone_id: string;
  duration_min: number;
  open_days: string; // CSV: 'mon,tue,wed,thu,fri,sat,sun'
  open_from: string; // 'HH:MM'
  open_to: string;   // 'HH:MM'
  net_price: number; // per person
  capacity_per_slot: number;
  dependency: Dependency;
}

export type LodgingTier = "budget" | "comfort" | "premium";

export interface Lodging {
  id: string;
  name: string;
  zone_id: string;
  tier: LodgingTier;
  net_price_per_night: number;
  capacity: number;
}

export interface ProviderPersonalization {
  provider_id: string;
  special_occasions: string | null;
  dietary_options: string | null;
  privacy_options: string | null;
  extras_on_request: string | null;
}

export type RequestStatus =
  | "building"
  | "awaiting_providers" // request sent to providers; waiting on acceptances
  | "proposals_ready"
  | "no_availability" // window closed with too few acceptances to build a trip
  | "paid"
  | "expired";

export interface ClientRequest {
  id: string;
  token: string;
  email: string;
  arrival_date: string;   // 'YYYY-MM-DD'
  departure_date: string; // 'YYYY-MM-DD'
  arrival_time: string;   // 'HH:MM'
  departure_time: string; // 'HH:MM'
  travelers: number;
  budget_total: number;
  prefs_json: ClientPrefs;
  free_text: string;
  status: RequestStatus;
  created_at: string;
}

export interface ClientPrefs {
  interests?: ExperienceCategory[];
  pace?: "relaxed" | "moderate" | "packed";
  mornings?: "early_ok" | "no_early";
  group_composition?: "solo" | "couple" | "friends" | "family";
  lodging_tier?: LodgingTier;
}

export type OrderStatus = "paid" | "settled";

export interface Order {
  id: string;
  request_id: string;
  chosen_itinerary_json: ItinerarySnapshot;
  client_price: number;
  status: OrderStatus;
  created_at: string;
}

export type OrderItemStatus = "booked" | "disrupted" | "replaced";

export interface OrderItem {
  id: string;
  order_id: string;
  item_type: "experience" | "lodging";
  ref_id: string;
  day_index: number;
  net_price: number;
  status: OrderItemStatus;
}

// ─── Engine types (used by SBI-05, referenced here for cross-module consistency) ───

export interface ItineraryDay {
  day_index: number;        // 1-based
  zone_id: string;
  lodging_id: string;
  experiences: ScheduledExperience[];
  transfer_in_minutes: number; // transfer from previous zone (0 on day 1)
}

export interface ScheduledExperience {
  experience_id: string;
  start_time: string; // 'HH:MM'
  end_time: string;   // 'HH:MM'
}

export interface ItinerarySnapshot {
  days: ItineraryDay[];
  net_total: number;
  client_total: number; // net_total * (1 + MARKUP_RATE)
  scores: ItineraryScores;
}

export interface ItineraryScores {
  transfer_efficiency: number; // 0–1
  interest_match: number;      // 0–1
  pace: number;                // 0–1
  breathing_room: number;      // 0–1
  variety: number;             // 0–1
  weighted_total: number;      // 0–1
}
