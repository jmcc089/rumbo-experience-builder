// Rumbo · SBI-06: Zod schemas for LLM output. All LLM output is untrusted input.

import { z } from "zod";

export const HardConstraintSchema = z.object({
  type: z.enum(["dietary", "mobility"]),
  value: z.string().min(1),
});

export const ExtractionOutputSchema = z.object({
  extra_hard_constraints: z.array(HardConstraintSchema),
  personalization_notes: z.array(z.string().min(1)),
});

export type HardConstraint = z.infer<typeof HardConstraintSchema>;
export type ExtractionOutput = z.infer<typeof ExtractionOutputSchema>;

export const SAFE_DEFAULT_EXTRACTION: ExtractionOutput = {
  extra_hard_constraints: [],
  personalization_notes: [],
};

export const ProviderInstructionsSchema = z.array(z.string().min(1));
