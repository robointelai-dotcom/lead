"use server";

import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

export type CampaignActionState = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  campaignId?: string;
};

const campaignSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  niche: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  goal: z.string().optional(),
  assignedUserId: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED", "COMPLETED"]).default("DRAFT"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  tags: z.string().optional(),
});

export async function createCampaignAction(
  _prev: CampaignActionState,
  formData: FormData
): Promise<CampaignActionState> {
  const session = await requireSession();

  const raw = Object.fromEntries(formData.entries());
  const parsed = campaignSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { tags: tagsJson, startDate, endDate, assignedUserId, ...rest } = parsed.data;

  try {
    // Parse tags
    let tagIds: string[] = [];
    if (tagsJson) {
      const tagNames: string[] = JSON.parse(tagsJson);
      
      // Instead of an upsert that fails due to missing IDs, let's fetch existing tags first
      const { data: existingTags, error: fetchError } = await supabase
        .from("tags")
        .select("id, name")
        .eq("organizationId", session.organizationId)
        .in("name", tagNames);
        
      if (fetchError) throw fetchError;
      
      const existingNames = (existingTags || []).map(t => t.name);
      const newNames = tagNames.filter(n => !existingNames.includes(n));
      
      let newTagRecords: { id: string }[] = [];
      if (newNames.length > 0) {
        const { data: createdTags, error: createError } = await supabase
          .from("tags")
          .insert(newNames.map(name => ({ id: randomUUID(), organizationId: session.organizationId, name })))
          .select("id");
          
        if (createError) throw createError;
        newTagRecords = createdTags || [];
      }
      
      tagIds = [...(existingTags || []).map(t => t.id), ...newTagRecords.map(t => t.id)];
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .insert({
        id: randomUUID(),
        organizationId: session.organizationId,
        ...rest,
        assignedUserId: assignedUserId || null,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
      })
      .select("id")
      .single();

    if (campaignError) throw campaignError;

    if (tagIds.length > 0) {
      const { error: ctError } = await supabase
        .from("campaign_tags")
        .insert(
          tagIds.map((tagId) => ({
            campaignId: campaign.id,
            tagId,
          }))
        );
      if (ctError) throw ctError;
    }

    revalidatePath("/campaigns");
    return { success: true, campaignId: campaign.id };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Failed to create campaign. Please try again." };
  }
}

export async function updateCampaignStatusAction(
  campaignId: string,
  status: "ACTIVE" | "PAUSED" | "ARCHIVED" | "COMPLETED"
): Promise<{ success: boolean; error?: string }> {
  const session = await requireSession();

  try {
    const { error } = await supabase
      .from("campaigns")
      .update({ status })
      .eq("id", campaignId)
      .eq("organizationId", session.organizationId);

    if (error) throw error;

    revalidatePath("/campaigns");
    revalidatePath(`/campaigns/${campaignId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update campaign status" };
  }
}

export async function deleteCampaignAction(
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await requireSession();

  try {
    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", campaignId)
      .eq("organizationId", session.organizationId);

    if (error) throw error;

    revalidatePath("/campaigns");
    return { success: true };
  } catch (err) {
    console.error("Delete campaign error:", err);
    return { success: false, error: "Failed to delete campaign" };
  }
}
