// Rumbo · SBI-06: LLM boundary — public entry points.

export { deriveWeights, selectProfile, selectedInterests, BASE_PROFILES } from "./weights";
export type { Profile } from "./weights";

export { extractConstraints } from "./extraction";
export type { ExtractionContext } from "./extraction";

export { generateProviderInstructions } from "./personalization";
export type { OrderProviderInstructions } from "./personalization";

export {
  HardConstraintSchema,
  ExtractionOutputSchema,
  SAFE_DEFAULT_EXTRACTION,
  ProviderInstructionsSchema,
} from "./schema";
export type { HardConstraint, ExtractionOutput } from "./schema";
