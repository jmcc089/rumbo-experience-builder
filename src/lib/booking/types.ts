// Rumbo · SBI-07: booking module shared types.
import { ClientPrefs, ItinerarySnapshot } from "../types";
import { OrderProviderInstructions } from "../llm";

export const HOLD_WINDOW_MINUTES = 15;

export interface IntakeInput {
  name: string;
  email: string;
  arrival_date: string; // YYYY-MM-DD
  departure_date: string;
  arrival_time: string; // HH:MM
  departure_time: string;
  travelers: number;
  budget_total: number;
  prefs_json: ClientPrefs;
  free_text: string;
}

export interface CreateRequestResult {
  id: string;
  token: string;
}

export interface ProposalsView {
  status: "ready" | "expired" | "not_ready" | "not_found";
  proposals?: ItinerarySnapshot[];
  expiresAt?: string; // ISO timestamp
}

export interface ConfirmAndPayResult {
  status: "paid" | "expired" | "not_found" | "invalid_choice";
  orderId?: string;
  itinerary?: ItinerarySnapshot;
  providerInstructions?: OrderProviderInstructions[];
}

/** Wiring points for SBI-08 (email). Left un-set = no-op. */
export interface PipelineHooks {
  notifyProposalsReady?: (args: { requestId: string; token: string; email: string }) => Promise<void> | void;
}

export interface PayHooks {
  notifyOrderConfirmed?: (args: {
    requestId: string;
    email: string;
    orderId: string;
    itinerary: ItinerarySnapshot;
  }) => Promise<void> | void;
}
