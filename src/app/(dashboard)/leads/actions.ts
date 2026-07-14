"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { enqueueGhlSync } from "@/lib/workers/ghlSyncer";
import { revalidatePath } from "next/cache";

const VALID_STATUSES = [
  "NEW",
  "CONTACTED",
  "REPLIED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "WON",
  "LOST",
  "DO_NOT_CONTACT",
] as const;

const schema = z.object({
  campaignLeadId: z.string().min(1),
  status: z.enum(VALID_STATUSES),
});

export type UpdateStatusResult = {
  success: boolean;
  error?: string;
  status?: string;
  ghlSyncEnqueued?: boolean;
};

/**
 * Manually promote / demote a lead's status inside a campaign.
 * Automatically enqueues a GHL contact upsert whenever the lead
 * transitions **into** the QUALIFIED bucket.
 *
 * Every DB access is org-scoped via the joined campaign.
 */
export async function updateCampaignLeadStatusAction(
  input: z.input<typeof schema>
): Promise<UpdateStatusResult> {
  const session = await requireSession();

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input" };
  }

  const { campaignLeadId, status } = parsed.data;

  try {
    const cl = await prisma.campaignLead.findFirst({
      where: {
        id: campaignLeadId,
        campaign: { organizationId: session.organizationId },
      },
      select: {
        id: true,
        status: true,
        leadId: true,
        campaignId: true,
        campaign: { select: { organizationId: true } },
      },
    });

    if (!cl) {
      return { success: false, error: "Campaign lead not found" };
    }

    if (cl.status === status) {
      return { success: true, status, ghlSyncEnqueued: false };
    }

    await prisma.$transaction([
      prisma.campaignLead.update({
        where: { id: cl.id },
        data: { status: status as never },
      }),
      prisma.leadStatusHistory.create({
        data: {
          campaignLeadId: cl.id,
          fromStatus: cl.status,
          toStatus: status as never,
          changedByUserId: session.userId,
        },
      }),
    ]);

    console.log(
      `[campaign-leads] user ${session.userId} moved ${cl.id} from ${cl.status} → ${status}`
    );

    let ghlSyncEnqueued = false;
    if (status === "QUALIFIED") {
      try {
        const jobId = await enqueueGhlSync({
          organizationId: session.organizationId,
          leadId: cl.leadId,
          campaignLeadId: cl.id,
          reason: "manual-status-change",
        });
        ghlSyncEnqueued = !!jobId;
      } catch (err) {
        console.error(
          "[campaign-leads] failed to enqueue GHL sync:",
          err
        );
      }
    }

    revalidatePath(`/campaigns/${cl.campaignId}`);
    revalidatePath(`/leads/${cl.leadId}`);

    return {
      success: true,
      status,
      ghlSyncEnqueued,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[campaign-leads] update status failed:", msg);
    return { success: false, error: msg };
  }
}
