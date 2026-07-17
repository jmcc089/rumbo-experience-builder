// Rumbo · SBI-06: Deterministic weight derivation.
// The LLM NEVER touches scoring weights. Profiles + dropdown adjustments only.

import { ExperienceCategory, ClientPrefs } from "../types";
import { ScoringWeights } from "../engine";

export type Profile = "relaxed" | "explorer" | "focused" | "comfortable";

export const BASE_PROFILES: Record<Profile, ScoringWeights> = {
  relaxed: { pace: 0.3, breathing_room: 0.25, interest_match: 0.25, transfer_efficiency: 0.15, variety: 0.05 },
  explorer: { variety: 0.3, interest_match: 0.25, transfer_efficiency: 0.2, pace: 0.15, breathing_room: 0.1 },
  focused: { interest_match: 0.4, transfer_efficiency: 0.2, pace: 0.2, breathing_room: 0.1, variety: 0.1 },
  comfortable: { transfer_efficiency: 0.3, breathing_room: 0.25, pace: 0.2, interest_match: 0.2, variety: 0.05 },
};

/** Selects the base profile from pace + group composition (deterministic, no LLM). */
export function selectProfile(prefs: Pick<ClientPrefs, "pace" | "group_composition">): Profile {
  if (prefs.pace === "relaxed") return "relaxed";
  if (prefs.pace === "packed") return "focused";
  // moderate pace: couples/families lean comfortable, others lean explorer
  if (prefs.group_composition === "couple" || prefs.group_composition === "family") {
    return "comfortable";
  }
  return "explorer";
}

function normalize(weights: ScoringWeights): ScoringWeights {
  const sum =
    weights.transfer_efficiency +
    weights.interest_match +
    weights.pace +
    weights.breathing_room +
    weights.variety;
  if (sum <= 0) return weights;
  return {
    transfer_efficiency: weights.transfer_efficiency / sum,
    interest_match: weights.interest_match / sum,
    pace: weights.pace / sum,
    breathing_room: weights.breathing_room / sum,
    variety: weights.variety / sum,
  };
}

/**
 * Derives final scoring weights from client dropdown selections.
 * Deterministic code only — the LLM never sets weights.
 */
export function deriveWeights(prefs: ClientPrefs): ScoringWeights {
  const profile = selectProfile(prefs);
  const base = { ...BASE_PROFILES[profile] };

  // Dropdown adjustments (small nudges, then re-normalize).
  if (prefs.mornings === "no_early") {
    base.breathing_room += 0.05;
    base.pace = Math.max(0, base.pace - 0.05);
  }
  if (prefs.lodging_tier === "premium") {
    base.transfer_efficiency += 0.05;
    base.variety = Math.max(0, base.variety - 0.05);
  }

  return normalize(base);
}

/** Interest categories the interest_match metric should count — direct from dropdowns. */
export function selectedInterests(prefs: ClientPrefs): ExperienceCategory[] {
  return prefs.interests ?? [];
}
