"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { enqueueGrowthReport } from "@/lib/workers/reportWorker";
import { revalidatePath } from "next/cache";

const regenSchema = z.object({
  leadId: z.string().min(1),
  niche: z.string().optional(),
});

/**
 * Manually (re)generate a Growth Report for a lead. Idempotency is
 * *bypassed* here — calling this always kicks off a fresh generation.
 */
export async function regenerateGrowthReportAction(
  input: z.input<typeof regenSchema>
): Promise<{ success: boolean; reportId?: string; error?: string }> {
  const session = await requireSession();
  const parsed = regenSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  try {
    // Confirm the lead belongs to this org
    const lead = await prisma.lead.findFirst({
      where: { id: parsed.data.leadId, organizationId: session.organizationId },
      select: { id: true, category: true },
    });
    if (!lead) return { success: false, error: "Lead not found" };

    const reportId = await enqueueGrowthReport({
      organizationId: session.organizationId,
      leadId: lead.id,
      niche: parsed.data.niche || lead.category || undefined,
      force: true,
    });

    revalidatePath("/growth-reports");
    revalidatePath(`/leads/${lead.id}`);
    return { success: true, reportId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[reports/actions] regenerate failed:", msg);
    return { success: false, error: msg };
  }
}

/**
 * Trigger a report email re-send. Useful when the initial send failed
 * (e.g. GHL was down) and the operator wants to retry without regen'ing.
 */
export async function resendGrowthReportAction(reportId: string) {
  const session = await requireSession();
  try {
    const report = await prisma.growthReport.findFirst({
      where: { id: reportId, organizationId: session.organizationId },
      include: { lead: { select: { email: true } } },
    });
    if (!report) return { success: false, error: "Report not found" };
    if (!report.lead.email) return { success: false, error: "Lead has no email address" };

    // Enqueue a full re-run — worker handles both generation & email
    await enqueueGrowthReport({
      organizationId: session.organizationId,
      leadId: report.leadId,
      niche: report.niche,
      force: true,
    });

    revalidatePath("/growth-reports");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[reports/actions] resend failed:", msg);
    return { success: false, error: msg };
  }
}
