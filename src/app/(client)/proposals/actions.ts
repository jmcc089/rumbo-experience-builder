"use server";

import { confirmAndPay, getRequestStatus } from "@/lib/booking";
import type { RequestStatus } from "@/lib/types";

export type BookTripResult =
  | { status: "paid"; orderId: string }
  | { status: "expired" }
  | { status: "not_found" }
  | { status: "invalid_choice" }
  | { status: "error" };

/**
 * Simulated payment. No data is collected and no gateway is touched — this
 * delegates straight to confirmAndPay (SBI-07), which materializes the order,
 * flips the request to "paid" and fires the confirmation email (SBI-08).
 * `chosenIndex` is the 0-based index of the selected proposal card.
 */
export async function bookTrip(token: string, chosenIndex: number): Promise<BookTripResult> {
  if (typeof token !== "string" || !token) return { status: "not_found" };
  if (!Number.isInteger(chosenIndex) || chosenIndex < 0) return { status: "invalid_choice" };

  try {
    const result = await confirmAndPay(token, chosenIndex);
    if (result.status === "paid") return { status: "paid", orderId: result.orderId! };
    return { status: result.status };
  } catch (err) {
    console.error(`[proposals] confirmAndPay failed for token ${token.slice(0, 8)}…:`, err);
    return { status: "error" };
  }
}

/** Poll target for the status page. Reads status without starting the hold. */
export async function pollStatus(token: string): Promise<{
  status: RequestStatus | "not_found";
}> {
  if (typeof token !== "string" || !token) return { status: "not_found" };
  return getRequestStatus(token);
}
