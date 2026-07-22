"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

const generateReportSchema = z.object({
  name: z.string().min(1, "Report name is required"),
  type: z.enum(["CAMPAIGN", "ANALYTICS", "PERFORMANCE", "AUDIT"]),
  campaignId: z.string().optional().nullable(),
  dateRange: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }).optional(),
});

export type GenerateReportState = {
  success: boolean;
  error?: string;
  reportId?: string;
};

/**
 * Server Action to generate a new report.
 * This aggregates data based on the selected type and campaign.
 */
export async function generateReportAction(
  _prev: GenerateReportState,
  formData: FormData
): Promise<GenerateReportState> {
  const session = await requireSession();

  const name = formData.get("name") as string;
  const type = formData.get("type") as "CAMPAIGN" | "ANALYTICS" | "PERFORMANCE" | "AUDIT";
  const campaignId = formData.get("campaignId") as string || null;

  const parsed = generateReportSchema.safeParse({ name, type, campaignId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    let reportData: any = {};

    if (type === "CAMPAIGN" && campaignId) {
      // Aggregate campaign-specific data
      const { data: leads } = await supabase
        .from("campaign_leads")
        .select(`
          status,
          lead:leads (qualityScore, email, phone)
        `)
        .eq("campaignId", campaignId);

      const stats = (leads || []).reduce((acc: any, curr: any) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        if (curr.lead?.email) acc.hasEmail = (acc.hasEmail || 0) + 1;
        if (curr.lead?.phone) acc.hasPhone = (acc.hasPhone || 0) + 1;
        acc.totalLeads = (acc.totalLeads || 0) + 1;
        acc.avgQuality = (acc.avgQuality || 0) + (curr.lead?.qualityScore || 0);
        return acc;
      }, { totalLeads: 0, avgQuality: 0 });

      if (stats.totalLeads > 0) {
        stats.avgQuality = Math.round(stats.avgQuality / stats.totalLeads);
      }

      reportData = {
        stats,
        generatedAt: new Date().toISOString(),
      };
    } else {
      // General performance across all campaigns
      const { data: campaigns } = await supabase
        .from("campaigns")
        .select(`
          id, name, status,
          leads:campaign_leads(count)
        `)
        .eq("organizationId", session.organizationId);

      reportData = {
        campaigns: (campaigns || []).map(c => ({
          name: c.name,
          leadsCount: c.leads?.[0]?.count || 0,
          status: c.status,
        })),
        totalCampaigns: campaigns?.length || 0,
        generatedAt: new Date().toISOString(),
      };
    }

    const { data: report, error: insertError } = await supabase
      .from("reports")
      .insert({
        organizationId: session.organizationId,
        campaignId: campaignId,
        createdByUserId: session.userId,
        name: name,
        type: type,
        data: reportData,
        generatedAt: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    revalidatePath("/reports");
    return { success: true, reportId: report.id };
  } catch (err: any) {
    console.error("[reports-actions] generation failed:", err);
    return { success: false, error: err.message || "Failed to generate report" };
  }
}

/**
 * Delete a report.
 */
export async function deleteReportAction(id: string) {
  const session = await requireSession();

  try {
    const { error } = await supabase
      .from("reports")
      .delete()
      .eq("id", id)
      .eq("organizationId", session.organizationId);

    if (error) throw error;
    revalidatePath("/reports");
    return { success: true };
  } catch (err: any) {
    console.error("[reports-actions] delete failed:", err);
    return { success: false, error: err.message };
  }
}
