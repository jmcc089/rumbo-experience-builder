"use server";
// Providers section — catalog write action. Parses the add-business form and
// inserts an experience business or a lodging, then revalidates the list.
import { revalidatePath } from "next/cache";
import {
  createExperienceBusiness,
  createLodging,
  updateExperience,
  updateLodging,
  type CreateResult,
} from "@/lib/operator/admin";

export async function createBusiness(formData: FormData): Promise<CreateResult> {
  const kind = String(formData.get("kind") ?? "");
  const num = (k: string) => Number(formData.get(k));
  const str = (k: string) => String(formData.get(k) ?? "").trim();

  let result: CreateResult;

  if (kind === "lodging") {
    result = await createLodging({
      name: str("name"),
      zone_id: str("zone_id"),
      tier: str("tier"),
      net_price_per_night: num("net_price_per_night"),
      capacity: num("capacity"),
    });
  } else if (kind === "experience") {
    const dependency = str("dependency");
    result = await createExperienceBusiness({
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
      provider_type: str("provider_type") || "informal",
      confirmation_mode: str("confirmation_mode") || "on_request",
      reliability_score: Number.isFinite(num("reliability_score")) ? num("reliability_score") : 0.85,
      base_popularity: Number.isFinite(num("base_popularity")) ? num("base_popularity") : 0.6,
      personalization: {
        special_occasions: str("special_occasions"),
        dietary_options: str("dietary_options"),
        privacy_options: str("privacy_options"),
        extras_on_request: str("extras_on_request"),
      },
    });
  } else {
    result = { ok: false, message: "Unknown business type." };
  }

  if (result.ok) revalidatePath("/operator/providers");
  return result;
}

export async function editExperience(id: string, formData: FormData): Promise<CreateResult> {
  const num = (k: string) => Number(formData.get(k));
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const dependency = str("dependency");

  const result = await updateExperience(id, {
    name: str("name"),
    zone_id: str("zone_id"),
    category: str("category"),
    duration_min: num("duration_min"),
    open_from: str("open_from"),
    open_to: str("open_to"),
    net_price: num("net_price"),
    capacity_per_slot: num("capacity_per_slot"),
    dependency: dependency || null,
  });

  if (result.ok) revalidatePath("/operator/providers");
  return result;
}

export async function editLodging(id: string, formData: FormData): Promise<CreateResult> {
  const num = (k: string) => Number(formData.get(k));
  const str = (k: string) => String(formData.get(k) ?? "").trim();

  const result = await updateLodging(id, {
    name: str("name"),
    zone_id: str("zone_id"),
    tier: str("tier"),
    net_price_per_night: num("net_price_per_night"),
    capacity: num("capacity"),
  });

  if (result.ok) revalidatePath("/operator/providers");
  return result;
}
