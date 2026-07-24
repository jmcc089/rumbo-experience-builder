"use server";

import { revalidatePath } from "next/cache";
import { recordProviderResponse } from "@/lib/provider";

export type RespondResult = { ok: true } | { ok: false; error: string };

/**
 * Provider confirm/decline. The NET rate is re-derived server-side inside
 * recordProviderResponse — the client never supplies a price. This is the
 * human-visible surface of the simulated availability step (SBI-04/07).
 */
export async function respondToRequest(
  providerId: string,
  requestId: string,
  experienceId: string,
  decision: "confirmed" | "declined"
): Promise<RespondResult> {
  if (!providerId || !requestId || !experienceId) {
    return { ok: false, error: "missing_fields" };
  }
  try {
    const result = await recordProviderResponse({ providerId, requestId, experienceId, decision });
    if (!result.ok) return { ok: false, error: result.error ?? "failed" };
    revalidatePath("/provider");
    return { ok: true };
  } catch (err) {
    console.error(`[provider] respondToRequest failed for ${providerId}:`, err);
    return { ok: false, error: "error" };
  }
}
