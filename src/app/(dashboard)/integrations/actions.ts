"use server";

import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { encryptToken } from "@/lib/crypto";
import { revalidatePath } from "next/cache";

/**
 * Save (or update) an integration for the current organization.
 * Encrypts the API key at rest so we never persist plaintext secrets.
 */
export async function saveIntegrationAction(
  type: "LEAD_PROVIDER" | "EMAIL_PROVIDER",
  name: string,
  provider: string,
  apiKey: string,
  isActive: boolean
) {
  const session = await requireSession();

  try {
    const encryptedApiKey = apiKey ? encryptToken(apiKey) : "";

    const { data: existing, error: fetchError } = await supabase
      .from("integrations")
      .select("*")
      .eq("organizationId", session.organizationId)
      .eq("provider", provider)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existing) {
      const { error: updateError } = await supabase
        .from("integrations")
        .update({
          credentials: encryptedApiKey
            ? { apiKey: encryptedApiKey }
            : (existing.credentials as object | null) || {},
          isActive,
        })
        .eq("id", existing.id);
      
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from("integrations")
        .insert({
          organizationId: session.organizationId,
          type,
          name,
          provider,
          credentials: encryptedApiKey ? { apiKey: encryptedApiKey } : {},
          isActive,
        });

      if (insertError) throw insertError;
    }

    revalidatePath("/integrations");
    return { success: true };
  } catch (err) {
    console.error("[integrations] saveIntegrationAction failed:", err);
    return { success: false, error: "Failed to save integration" };
  }
}

/**
 * Deactivate an integration for the current org.
 */
export async function disconnectIntegrationAction(provider: string) {
  const session = await requireSession();

  try {
    const { data: existing, error: fetchError } = await supabase
      .from("integrations")
      .select("id")
      .eq("organizationId", session.organizationId)
      .eq("provider", provider)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existing) {
      const { error: updateError } = await supabase
        .from("integrations")
        .update({ isActive: false })
        .eq("id", existing.id);
      
      if (updateError) throw updateError;
    }

    revalidatePath("/integrations");
    return { success: true };
  } catch (err) {
    console.error("[integrations] disconnectIntegrationAction failed:", err);
    return { success: false, error: "Failed to disconnect integration" };
  }
}
