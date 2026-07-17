// Rumbo · SBI-07: wires real paid-order consumption into SBI-04's availability model.
//
// order_items store day_index (itinerary-relative), not an absolute calendar
// date — the absolute date for a given item is the owning request's
// arrival_date + (day_index - 1) days. This computes, for a given experience
// and calendar date, how many traveler-spots are already consumed by paid
// orders on that date (the `realOrderConsumption` term SBI-04 stubbed at 0).
import { getOrderItemsForExperience } from "./store";

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function spotsConsumedByRealOrders(experienceId: string, date: string): Promise<number> {
  const items = await getOrderItemsForExperience(experienceId);
  let consumed = 0;
  for (const item of items) {
    const itemDate = addDays(item.arrival_date, item.day_index - 1);
    if (itemDate === date) consumed += item.travelers;
  }
  return consumed;
}
