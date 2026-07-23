"use server";

import { revalidatePath } from "next/cache";
import { recordProviderResponse, getProviderBookings } from "@/lib/provider";
import { reportDropoutAndRepair, getOrderClientContact } from "@/lib/repair";
import { sendItineraryChanged } from "@/lib/email";

export type RespondResult = { ok: true } | { ok: false; error: string };

export type DeliverResult =
  | { ok: true; repaired: true; newService: string | null }
  | { ok: true; repaired: false; reason: string }
  | { ok: false; error: string };

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

/**
 * Provider reports they can no longer deliver a booked service. Guards that the
 * order item really belongs to the acting provider, then hands off to the
 * repair engine to re-solve that day of the paid itinerary.
 */
export async function reportCannotDeliver(
  providerId: string,
  orderItemId: string,
  orderId: string
): Promise<DeliverResult> {
  if (!providerId || !orderItemId || !orderId) {
    return { ok: false, error: "missing_fields" };
  }
  try {
    const bookings = await getProviderBookings(providerId);
    const owned = bookings.some((b) => b.orderItemId === orderItemId && b.orderId === orderId);
    if (!owned) return { ok: false, error: "not_owned" };

    const outcome = await reportDropoutAndRepair(orderId, orderItemId);
    revalidatePath("/provider");
    if (outcome.repaired) {
      // Notify the client their itinerary changed (best-effort, never blocks).
      try {
        const contact = await getOrderClientContact(orderId);
        if (contact?.email && contact.token) {
          const dayNumber = outcome.dayIndex != null ? outcome.dayIndex + 1 : undefined;
          await sendItineraryChanged(contact.email, contact.token, dayNumber);
        }
      } catch (err) {
        console.error(`[provider] itinerary-changed email failed for order ${orderId}:`, err);
      }
      return { ok: true, repaired: true, newService: null };
    }
    return { ok: true, repaired: false, reason: outcome.reason ?? "No replacement found" };
  } catch (err) {
    console.error(`[provider] reportCannotDeliver failed for ${providerId}:`, err);
    return { ok: false, error: "error" };
  }
}
