"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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
      const tagRecords = await Promise.all(
        tagNames.map((name) =>
          prisma.tag.upsert({
            where: { organizationId_name: { organizationId: session.organizationId, name } },
            update: {},
            create: { organizationId: session.organizationId, name },
          })
        )
      );
      tagIds = tagRecords.map((t) => t.id);
    }

    const campaign = await prisma.campaign.create({
      data: {
        organizationId: session.organizationId,
        ...rest,
        assignedUserId: assignedUserId || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        tags: {
          create: tagIds.map((tagId) => ({ tagId })),
        },
      },
    });

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
    await prisma.campaign.updateMany({
      where: { id: campaignId, organizationId: session.organizationId },
      data: { status },
    });
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
    // Delete the campaign - Cascade delete in schema will handle CampaignLead, SearchJob, etc.
    await prisma.campaign.delete({
      where: { 
        id: campaignId,
        organizationId: session.organizationId 
      },
    });

    revalidatePath("/campaigns");
    return { success: true };
  } catch (err) {
    console.error("Delete campaign error:", err);
    return { success: false, error: "Failed to delete campaign" };
  }
}
