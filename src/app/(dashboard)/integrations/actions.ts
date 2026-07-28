"use server";

import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { encryptToken } from "@/lib/crypto";
import { revalidatePath } from "next/cache";

export async function saveIntegrationAction(
  type: "LEAD_PROVIDER" | "EMAIL_PROVIDER" | "CRM" | "WEBHOOK",
  name: string,
  provider: string,
  apiKey: string,
  isActive: boolean
) {
  const session = await requireSession();

  try {
    const encryptedApiKey = apiKey ? encryptToken(apiKey) : "";

    const { data: existingRows, error: fetchError } = await supabase
      .from("integrations")
      .select("*")
      .eq("organizationId", session.organizationId)
      .eq("provider", provider)
      .limit(1);

    if (fetchError) throw fetchError;
    const existing = existingRows?.[0];

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

export async function disconnectIntegrationAction(provider: string) {
  const session = await requireSession();

  try {
    const { data: existingRows, error: fetchError } = await supabase
      .from("integrations")
      .select("id")
      .eq("organizationId", session.organizationId)
      .eq("provider", provider)
      .limit(1);

    if (fetchError) throw fetchError;
    const existing = existingRows?.[0];

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
