"use server";
// Customers section — edit a customer's contact + trip details.
import { revalidatePath } from "next/cache";
import { updateCustomer, type CreateResult } from "@/lib/operator/admin";

export async function editCustomer(id: string, formData: FormData): Promise<CreateResult> {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const num = (k: string) => Number(formData.get(k));
  const result = await updateCustomer(id, {
    name: str("name"),
    email: str("email"),
    arrival_date: str("arrival_date"),
    departure_date: str("departure_date"),
    travelers: num("travelers"),
    budget_total: num("budget_total"),
  });
  if (result.ok) revalidatePath("/operator/customers");
  return result;
}
