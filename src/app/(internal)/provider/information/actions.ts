"use server";
// Provider · Information — the business edits its own profile (name, location)
// and personalization. Scoped to the acting provider.
import { revalidatePath } from "next/cache";
import { updateProviderProfile, type CreateResult } from "@/lib/operator/admin";

export async function saveProfile(
  providerId: string,
  formData: FormData
): Promise<CreateResult> {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const result = await updateProviderProfile(providerId, {
    name: str("name"),
    zone_id: str("zone_id"),
    special_occasions: str("special_occasions"),
    dietary_options: str("dietary_options"),
    privacy_options: str("privacy_options"),
    extras_on_request: str("extras_on_request"),
  });
  if (result.ok) revalidatePath("/provider/information");
  return result;
}
