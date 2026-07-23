"use server";
// Orders section — cancel an order. There is no cancellation status or
// soft-delete flag in this prototype's schema, so a cancel is a hard delete.
import { revalidatePath } from "next/cache";
import { deleteOrder, type CreateResult } from "@/lib/operator/admin";

export async function cancelOrder(id: string): Promise<CreateResult> {
  const result = await deleteOrder(id);
  if (result.ok) revalidatePath("/operator/customers");
  return result;
}
