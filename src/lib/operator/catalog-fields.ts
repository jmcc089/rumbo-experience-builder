// Client-safe catalog field constants + shared types for the Providers form.
// Kept free of any server-only imports (no DB pool) so it can be pulled into
// the client bundle. admin.ts (server) also imports from here.

export const EXPERIENCE_CATEGORIES = [
  "nature",
  "food",
  "culture",
  "beach",
  "adventure",
  "coffee",
] as const;

export const DEPENDENCIES = [
  "sunrise_only",
  "tide_dependent",
  "weather_sensitive",
] as const;

export const LODGING_TIERS = ["budget", "comfort", "premium"] as const;

export const PROVIDER_TYPES = ["formal", "informal"] as const;
export const CONFIRMATION_MODES = ["instant", "on_request"] as const;
export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export interface ZoneOption {
  id: string;
  name: string;
  region: string;
}
