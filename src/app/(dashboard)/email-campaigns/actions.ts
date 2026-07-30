"use server";

import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { GMassClient } from "@/lib/gmass-client";
import { findIntegrationApiKey } from "@/lib/integrations";
import { processEmailCampaignLocally } from "@/lib/workers/emailCampaignWorker";

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

export async function updateEmailCampaignStatusAction(id: string, status: string) {
  const session = await requireSession();

  const { error } = await supabase
    .from("email_campaigns")
    .update({ status })
    .eq("id", id)
    .eq("organizationId", session.organizationId);

  if (error) {
    return { success: false, error: error.message };
  }

  if (status === "SENDING") {
    // Fire and forget (do not await) so the UI doesn't block
    processEmailCampaignLocally(id, session.organizationId).catch(console.error);
  }

  revalidatePath("/email-campaigns");
  revalidatePath(`/email-campaigns/${id}`);
  return { success: true };
}

export async function sendTestEmailAction(id: string, testEmail: string) {
  const session = await requireSession();

  const { data: campaign, error } = await supabase
    .from("email_campaigns")
    .select("subject, htmlContent, textContent, organizationId")
    .eq("id", id)
    .eq("organizationId", session.organizationId)
    .single();

  if (error || !campaign) {
    return { success: false, error: "Campaign not found" };
  }

  // Get integrations to find GMass key
  const { data: integrations } = await supabase
    .from("integrations")
    .select("*")
    .eq("organizationId", session.organizationId);

  const gmassKey = findIntegrationApiKey(integrations || [], "gmass", ["API_KEY"]);
  
  if (!gmassKey) {
    return { success: false, error: "GMass integration not configured. Please add your API key in Settings > Integrations." };
  }

  const client = new GMassClient(gmassKey);
  
  // Replace variables with mock data for test
  let html = campaign.htmlContent;
  let subject = campaign.subject;
  const mockVars: Record<string, string> = {
    "{{PracticeName}}": "Test Dental Clinic",
    "{{BrokenThing}}": "Missing SSL",
    "{{BrokenState}}": "Insecure",
    "{{OneLineConsequence}}": "Patients will see a warning when visiting your site.",
    "{{SecondFinding}}": "slow page load speed",
    "{{ThirdFinding}}": "no mobile optimization",
    "{{ReviewCount}}": "142",
    "{{Rating}}": "4.8",
    "{{ReportLink}}": "https://leadflow.app/sample-report",
    "{{SenderName}}": session.name || "Your Name",
    "{{Company}}": session.organizationName || "Growth Agency",
    "{{Phone}}": "555-0199",
    "{{PostalAddress}}": "123 Business Rd, Suite 100",
    "{{UnsubscribeLink}}": "#"
  };

  Object.entries(mockVars).forEach(([k, v]) => {
    const regex = new RegExp(k.replace(/[{}]/g, '\\$&'), 'gi');
    html = html.replace(regex, v);
    subject = subject.replace(regex, v);
  });

  const res = await client.sendEmail({
    to: testEmail,
    fromEmail: session.email || "test@leadflow.app",
    fromName: session.name || "LeadFlow Test",
    subject: `[TEST] ${subject}`,
    html: html
  });

  if (!res.success) {
    return { success: false, error: res.errorMessage };
  }

  return { success: true };
}
