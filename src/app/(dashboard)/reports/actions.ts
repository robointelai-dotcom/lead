"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const generateReportSchema = z.object({
  name: z.string().min(1, "Report name is required"),
  type: z.enum(["CAMPAIGN", "ANALYTICS", "PERFORMANCE", "AUDIT"]),
  campaignId: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
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
 * This aggregates data based on the selected type and campaign/lead.
 */
export async function generateReportAction(
  _prev: GenerateReportState | undefined | any,
  formData: FormData
): Promise<GenerateReportState> {
  const session = await requireSession();

  const name = formData.get("name") as string;
  const type = formData.get("type") as "CAMPAIGN" | "ANALYTICS" | "PERFORMANCE" | "AUDIT";
  const campaignId = formData.get("campaignId") as string || null;
  const leadId = formData.get("leadId") as string || null;

  const parsed = generateReportSchema.safeParse({ name, type, campaignId, leadId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    let reportData: any = {};

    if (type === "AUDIT" && leadId) {
      // Aggregate single lead audit data
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select(`
          *,
          campaignLeads:campaign_leads(
            *,
            campaign:campaigns(name),
            statusHistory:lead_status_history(*)
          )
        `)
        .eq("id", leadId)
        .eq("organizationId", session.organizationId)
        .single();

      if (leadError || !lead) throw new Error("Lead not found");

      reportData = {
        lead: {
          businessName: lead.businessName,
          email: lead.email,
          phone: lead.phone,
          website: lead.website,
          qualityScore: lead.qualityScore,
          category: lead.category,
          address: lead.address,
          city: lead.city,
          state: lead.state,
          sourceProvider: lead.sourceProvider,
          createdAt: lead.createdAt,
        },
        memberships: (lead.campaignLeads || []).map((cl: any) => ({
          campaignName: cl.campaign?.name,
          status: cl.status,
          history: cl.statusHistory || [],
        })),
        generatedAt: new Date().toISOString(),
      };
    } else if (type === "CAMPAIGN" && campaignId) {
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
        id: crypto.randomUUID(),
        organizationId: session.organizationId,
        campaignId: campaignId,
        createdByUserId: session.userId,
        name: name,
        type: type,
        data: reportData,
        generatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    revalidatePath("/reports");
  } catch (err: any) {
    console.error("[reports-actions] generation failed:", err);
    return { success: false, error: err.message || "Failed to generate report" };
  }

  redirect("/reports");
}

/**
 * Dedicated wrapper for direct form actions to satisfy TS (returns void).
 */
export async function generateReportFormAction(formData: FormData): Promise<void> {
  await generateReportAction(undefined, formData);
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
