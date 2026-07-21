"use server";

import { z } from "zod";
import { supabase } from "@/lib/supabase";
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
    const { data: cl, error: fetchError } = await supabase
      .from("campaign_leads")
      .select(`
        id,
        status,
        leadId,
        campaignId,
        campaigns!inner(organizationId)
      `)
      .eq("id", campaignLeadId)
      .eq("campaigns.organizationId", session.organizationId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!cl) {
      return { success: false, error: "Campaign lead not found" };
    }

    if (cl.status === status) {
      return { success: true, status, ghlSyncEnqueued: false };
    }

    // Replace Prisma transaction with sequential Supabase calls
    const { error: updateError } = await supabase
      .from("campaign_leads")
      .update({ status })
      .eq("id", cl.id);

    if (updateError) throw updateError;

    const { error: historyError } = await supabase
      .from("lead_status_history")
      .insert({
        campaignLeadId: cl.id,
        fromStatus: cl.status,
        toStatus: status,
        changedByUserId: session.userId,
      });

    if (historyError) throw historyError;

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
