// Rumbo · SBI-06: Free-text → extra hard constraints + personalization notes.
// The ONLY LLM input is the client's free-text field. Dropdowns are structured
// separately and are never overridden by this layer.

import { ExperienceCategory, ClientPrefs } from "../types";
import { callDeepSeekJson } from "./client";
import { ExtractionOutput, ExtractionOutputSchema, SAFE_DEFAULT_EXTRACTION } from "./schema";

const AVAILABLE_CATEGORIES: ExperienceCategory[] = [
  "nature",
  "food",
  "culture",
  "beach",
  "adventure",
  "coffee",
];

const SYSTEM_PROMPT = `You extract structured signals from a tour client's free-text trip description.
Return ONLY a single JSON object, no prose, no markdown fences, matching exactly:
{
  "extra_hard_constraints": [{ "type": "dietary" | "mobility", "value": string }],
  "personalization_notes": string[]
}
Rules:
- "extra_hard_constraints": only real dietary restrictions (e.g. vegetarian, vegan, gluten-free, allergy) or
  mobility limitations (e.g. wheelchair, limited walking). Do NOT invent constraints not implied by the text.
- "personalization_notes": short tags for tone/occasion/preference (e.g. "anniversary", "first_time_visitor",
  "avoid_touristy", "celebration", "photography_focused"). Keep each note 1-3 words, lowercase, snake_case.
- Do NOT restate the dropdown selections given as context — only add what the free text uniquely reveals.
- If nothing applies, return empty arrays.`;

export interface ExtractionContext {
  interests: ExperienceCategory[];
  pace: ClientPrefs["pace"];
  mornings: ClientPrefs["mornings"];
  group_composition: ClientPrefs["group_composition"];
  lodging_tier: ClientPrefs["lodging_tier"];
}

function buildUserPrompt(freeText: string, context: ExtractionContext): string {
  return JSON.stringify({
    free_text: freeText,
    available_categories: AVAILABLE_CATEGORIES,
    dropdown_selections: context,
  });
}

/**
 * Extracts extra hard constraints + personalization notes from free text.
 * Fails safe: any error, malformed JSON, or Zod validation failure returns
 * the safe default (empty arrays) so the engine still runs on dropdowns alone.
 */
export async function extractConstraints(
  freeText: string,
  context: ExtractionContext
): Promise<ExtractionOutput> {
  if (!freeText || !freeText.trim()) return SAFE_DEFAULT_EXTRACTION;

  const raw = await callDeepSeekJson(SYSTEM_PROMPT, buildUserPrompt(freeText, context));
  if (!raw) return SAFE_DEFAULT_EXTRACTION;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return SAFE_DEFAULT_EXTRACTION;
  }

  const result = ExtractionOutputSchema.safeParse(parsed);
  if (!result.success) return SAFE_DEFAULT_EXTRACTION;

  return result.data;
}
