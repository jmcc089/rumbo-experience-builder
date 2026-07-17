"use server";
// Rumbo · SBI-13: repair demo trigger surface — operator dashboard actions.
import { revalidatePath } from "next/cache";
import { disruptOrder, repairOrder } from "@/lib/repair";

export async function triggerDisruption(orderId: string) {
  const result = await disruptOrder(orderId);
  revalidatePath("/operator");
  return result;
}

export async function triggerRepair(orderId: string) {
  const result = await repairOrder(orderId);
  revalidatePath("/operator");
  return result;
}
