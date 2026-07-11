// Rumbo · SBI-06: Personalization layer.
// Cross-references personalization_notes (from free text) against a SELECTED
// provider's own provider_personalization row and produces concrete instruction
// strings attached to the order. Corpus is tiny (~25 providers x 3-4 lines), so
// the relevant provider's capabilities are passed directly in the prompt rather
// than standing up a vector store.

import { ProviderPersonalization } from "../types";
import { callDeepSeekJson } from "./client";
import { ProviderInstructionsSchema } from "./schema";

const SYSTEM_PROMPT = `You write short operational instructions for a tour provider based on a client's
personalization notes and the provider's own stated capabilities.
Return ONLY a single JSON object, no prose, no markdown fences, matching exactly:
{ "instructions": string[] }
Rules:
- Only produce an instruction when a note is actually supported by the provider's capabilities.
- Each instruction is one short imperative sentence (e.g. "Prepare a private table; couple celebrating anniversary.").
- Do NOT invent capabilities the provider does not list.
- If nothing matches, return { "instructions": [] }.`;

function buildUserPrompt(notes: string[], provider: ProviderPersonalization): string {
  return JSON.stringify({
    personalization_notes: notes,
    provider_capabilities: {
      special_occasions: provider.special_occasions,
      dietary_options: provider.dietary_options,
      privacy_options: provider.privacy_options,
      extras_on_request: provider.extras_on_request,
    },
  });
}

/** Deterministic fallback: simple keyword overlap, no LLM. Used if the call fails or output is invalid. */
function fallbackInstructions(notes: string[], provider: ProviderPersonalization): string[] {
  const fields: Array<[string, string | null]> = [
    ["special occasions", provider.special_occasions],
    ["dietary options", provider.dietary_options],
    ["privacy options", provider.privacy_options],
    ["extras on request", provider.extras_on_request],
  ];
  const instructions: string[] = [];
  for (const note of notes) {
    for (const [label, value] of fields) {
      if (value && value.toLowerCase().includes(note.toLowerCase().replace(/_/g, " "))) {
        instructions.push(`Note: ${note} — provider offers ${label}: ${value}.`);
      }
    }
  }
  return instructions;
}

/**
 * Produces per-provider instruction strings from personalization notes.
 * Additive only — never affects selection, pricing, or availability.
 * Fails safe to a deterministic keyword-overlap fallback on any LLM error.
 */
export async function generateProviderInstructions(
  notes: string[],
  provider: ProviderPersonalization
): Promise<string[]> {
  if (!notes.length) return [];

  const raw = await callDeepSeekJson(SYSTEM_PROMPT, buildUserPrompt(notes, provider));
  if (!raw) return fallbackInstructions(notes, provider);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallbackInstructions(notes, provider);
  }

  const obj = parsed as { instructions?: unknown };
  const result = ProviderInstructionsSchema.safeParse(obj.instructions);
  if (!result.success) return fallbackInstructions(notes, provider);

  return result.data;
}

/** Per-provider instructions attached to an order (SBI-07 consumes this shape). */
export interface OrderProviderInstructions {
  provider_id: string;
  instructions: string[];
}
