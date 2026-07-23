"use server";
// Provider · Services — a business editing its own experience catalog. Parses
// the shared experience form and adds or updates one experience, scoped to the
// acting provider.
import { revalidatePath } from "next/cache";
import {
  addExperienceToProvider,
  updateProviderExperience,
  type CreateResult,
  type ProviderExperienceInput,
} from "@/lib/operator/admin";

function parse(formData: FormData): ProviderExperienceInput {
  const num = (k: string) => Number(formData.get(k));
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const dependency = str("dependency");
  return {
    name: str("name"),
    zone_id: str("zone_id"),
    category: str("category"),
    duration_min: num("duration_min"),
    open_days: formData.getAll("open_days").map(String),
    open_from: str("open_from"),
    open_to: str("open_to"),
    net_price: num("net_price"),
    capacity_per_slot: num("capacity_per_slot"),
    dependency: dependency || null,
  };
}

export async function addExperience(
  providerId: string,
  formData: FormData
): Promise<CreateResult> {
  const result = await addExperienceToProvider(providerId, parse(formData));
  if (result.ok) revalidatePath("/provider/services");
  return result;
}

export async function editExperience(
  providerId: string,
  experienceId: string,
  formData: FormData
): Promise<CreateResult> {
  const result = await updateProviderExperience(providerId, experienceId, parse(formData));
  if (result.ok) revalidatePath("/provider/services");
  return result;
}
