"use server";

import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function deleteEmailCampaignAction(id: string) {
  const session = await requireSession();

  const { error } = await supabase
    .from("email_campaigns")
    .delete()
    .eq("id", id)
    .eq("organizationId", session.organizationId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/email-campaigns");
  return { success: true };
}
