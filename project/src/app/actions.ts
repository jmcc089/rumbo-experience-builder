"use server";

import { after } from "next/server";
import { createRequest, runRequestPipeline } from "@/lib/booking";
import type { IntakeInput } from "@/lib/booking";
import type { ClientPrefs, ExperienceCategory } from "@/lib/types";
import { MAX_TRIP_SPAN_DAYS, tripSpanDays } from "@/lib/config";

/**
 * Payload shipped from the intake form (client component) to the server.
 * All hard data stays structured; only `free_text` is LLM-bound downstream.
 */
export interface IntakePayload {
  email: string;
  arrival_date: string; // YYYY-MM-DD
  departure_date: string; // YYYY-MM-DD
  arrival_time: string; // HH:MM
  departure_time: string; // HH:MM
  travelers: number;
  budget_total: number;
  interests: ExperienceCategory[];
  pace: ClientPrefs["pace"];
  mornings: ClientPrefs["mornings"];
  group_composition: ClientPrefs["group_composition"];
  lodging_tier: ClientPrefs["lodging_tier"];
  free_text: string;
}

export type SubmitIntakeResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

/**
 * Persist the client's request (status "building") and fire Email 1.
 * `createRequest` sends the acknowledgment email itself (SBI-08).
 *
 * We then kick off the build pipeline via `after()`, so the client
 * immediately sees the "we're building your experience" state and is
 * re-engaged later by Email 2 (proposals-ready) — the async design in SBI-00.
 * `after()` keeps the serverless invocation alive until the pipeline settles,
 * which a bare fire-and-forget promise does not guarantee on Vercel.
 */
export async function submitIntake(
  payload: IntakePayload
): Promise<SubmitIntakeResult> {
  // Minimal server-side guard — the client validates per step, but a Server
  // Action is reachable directly, so re-check the essentials here.
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid submission." };
  }
  if (!isEmail(payload.email)) {
    return { ok: false, error: "A valid email is required." };
  }
  if (!payload.arrival_date || !payload.departure_date) {
    return { ok: false, error: "Arrival and departure dates are required." };
  }
  if (payload.departure_date < payload.arrival_date) {
    return { ok: false, error: "Departure cannot be before arrival." };
  }
  if (tripSpanDays(payload.arrival_date, payload.departure_date) > MAX_TRIP_SPAN_DAYS) {
    return {
      ok: false,
      error: `We currently build trips of up to ${MAX_TRIP_SPAN_DAYS + 1} days. Please choose a departure within ${MAX_TRIP_SPAN_DAYS} days of your arrival.`,
    };
  }
  if (!(payload.travelers >= 1)) {
    return { ok: false, error: "At least one traveler is required." };
  }
  if (!(payload.budget_total > 0)) {
    return { ok: false, error: "A budget greater than zero is required." };
  }

  const prefs: ClientPrefs = {
    interests: payload.interests,
    pace: payload.pace,
    mornings: payload.mornings,
    group_composition: payload.group_composition,
    lodging_tier: payload.lodging_tier,
  };

  const intake: IntakeInput = {
    email: payload.email.trim(),
    arrival_date: payload.arrival_date,
    departure_date: payload.departure_date,
    arrival_time: payload.arrival_time,
    departure_time: payload.departure_time,
    travelers: payload.travelers,
    budget_total: payload.budget_total,
    prefs_json: prefs,
    free_text: payload.free_text.trim(),
  };

  try {
    const { id, token } = await createRequest(intake);

    // Kick off the build after the response is sent, without blocking it.
    after(() =>
      runRequestPipeline(id).catch((err) => {
        console.error(`[intake] pipeline failed for request ${id}:`, err);
      })
    );

    return { ok: true, token };
  } catch (err) {
    console.error("[intake] createRequest failed:", err);
    return {
      ok: false,
      error: "We couldn't save your request. Please try again.",
    };
  }
}

function isEmail(v: unknown): v is string {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
