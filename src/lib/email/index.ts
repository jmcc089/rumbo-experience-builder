// Rumbo · SBI-08: email module public surface.
export { sendEmail, getAppBaseUrl } from "./client";
export {
  acknowledgmentEmail,
  proposalsReadyEmail,
  purchaseConfirmationEmail,
  itineraryChangedEmail,
} from "./templates";
export type { EmailContent, OrderSummary, OrderSummaryDay } from "./templates";

import { sendEmail } from "./client";
import {
  acknowledgmentEmail,
  proposalsReadyEmail,
  purchaseConfirmationEmail,
  itineraryChangedEmail,
  OrderSummary,
} from "./templates";

/** Trigger 1: on intake submit. */
export async function sendAcknowledgment(to: string): Promise<void> {
  const { subject, html } = acknowledgmentEmail();
  await sendEmail({ to, subject, html });
}

/** Trigger 2: when the pipeline finishes and proposals are ready. */
export async function sendProposalsReady(to: string, token: string): Promise<void> {
  const { subject, html } = proposalsReadyEmail(token);
  await sendEmail({ to, subject, html });
}

/** Trigger 3: when the client pays. */
export async function sendPurchaseConfirmation(to: string, order: OrderSummary, token: string): Promise<void> {
  const { subject, html } = purchaseConfirmationEmail(order, token);
  await sendEmail({ to, subject, html });
}

/** Trigger 4: when a post-booking repair re-books a day of a paid itinerary. */
export async function sendItineraryChanged(to: string, token: string, dayNumber?: number): Promise<void> {
  const { subject, html } = itineraryChangedEmail(token, dayNumber);
  await sendEmail({ to, subject, html });
}
