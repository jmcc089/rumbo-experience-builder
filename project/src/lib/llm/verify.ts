// Rumbo · SBI-06 verification script. Run with: npx tsx src/lib/llm/verify.ts

import { deriveWeights, BASE_PROFILES } from "./weights";
import { extractConstraints } from "./extraction";
import { generateProviderInstructions } from "./personalization";
import { ExtractionOutputSchema, SAFE_DEFAULT_EXTRACTION } from "./schema";
import type { ScoringWeights } from "../engine";

function sum(w: ScoringWeights): number {
  return w.transfer_efficiency + w.interest_match + w.pace + w.breathing_room + w.variety;
}

async function main() {
  let failures = 0;

  // 1. Base profiles sum to 1.
  for (const [name, w] of Object.entries(BASE_PROFILES)) {
    const s = sum(w);
    const ok = Math.abs(s - 1) < 1e-9;
    console.log(`[profile:${name}] sum=${s.toFixed(4)} ${ok ? "OK" : "FAIL"}`);
    if (!ok) failures++;
  }

  // 2. Weight derivation always sums to 1, for various dropdown combos.
  const combos = [
    { pace: "relaxed" as const, mornings: "early_ok" as const, group_composition: "solo" as const, lodging_tier: "budget" as const },
    { pace: "packed" as const, mornings: "no_early" as const, group_composition: "friends" as const, lodging_tier: "premium" as const },
    { pace: "moderate" as const, mornings: "early_ok" as const, group_composition: "couple" as const, lodging_tier: "premium" as const },
    { pace: "moderate" as const, mornings: "no_early" as const, group_composition: "solo" as const, lodging_tier: "comfort" as const },
  ];
  for (const c of combos) {
    const w = deriveWeights(c);
    const s = sum(w);
    const ok = Math.abs(s - 1) < 1e-9;
    console.log(`[derive] ${JSON.stringify(c)} -> sum=${s.toFixed(4)} ${ok ? "OK" : "FAIL"}`);
    if (!ok) failures++;
  }

  // 3. Safe default shape validates against schema.
  const defaultOk = ExtractionOutputSchema.safeParse(SAFE_DEFAULT_EXTRACTION).success;
  console.log(`[schema] safe default validates: ${defaultOk ? "OK" : "FAIL"}`);
  if (!defaultOk) failures++;

  // 4. Extraction fails safe when no API key / no network (expected in most local runs).
  const extraction = await extractConstraints(
    "anniversary, my wife is vegetarian, we love coffee, avoid touristy spots",
    { interests: ["coffee"], pace: "moderate", mornings: "early_ok", group_composition: "couple", lodging_tier: "comfort" }
  );
  console.log(`[extraction] result=${JSON.stringify(extraction)}`);
  const shapeOk = ExtractionOutputSchema.safeParse(extraction).success;
  console.log(`[extraction] shape valid: ${shapeOk ? "OK" : "FAIL"}`);
  if (!shapeOk) failures++;
  if (!process.env.DEEPSEEK_API_KEY) {
    const isSafeDefault =
      extraction.extra_hard_constraints.length === 0 && extraction.personalization_notes.length === 0;
    console.log(`[extraction] no API key -> safe default: ${isSafeDefault ? "OK" : "FAIL"}`);
    if (!isSafeDefault) failures++;
  }

  // 5. Personalization fallback (no API key) still returns a valid string array.
  const instructions = await generateProviderInstructions(["anniversary"], {
    provider_id: "test",
    special_occasions: "We set up private tables for anniversaries and honeymoons",
    dietary_options: null,
    privacy_options: null,
    extras_on_request: null,
  });
  console.log(`[personalization] instructions=${JSON.stringify(instructions)}`);
  const arrOk = Array.isArray(instructions);
  console.log(`[personalization] is array: ${arrOk ? "OK" : "FAIL"}`);
  if (!arrOk) failures++;

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
