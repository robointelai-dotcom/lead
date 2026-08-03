"use server";

import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { GMassClient } from "@/lib/gmass-client";
import { findIntegrationApiKey } from "@/lib/integrations";
import { processEmailCampaignLocally } from "@/lib/workers/emailCampaignWorker";
import { decryptToken } from "@/lib/crypto";
import nodemailer from "nodemailer";

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
    // Await the background process so the Server Action doesn't close prematurely.
    // This guarantees execution on Hostinger and Vercel.
    await processEmailCampaignLocally(id, session.organizationId);
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

  // Get integrations to find GMass or SMTP key
  const { data: integrations } = await supabase
    .from("integrations")
    .select("*")
    .eq("organizationId", session.organizationId)
    .eq("isActive", true);

  const activeIntegrations = integrations || [];
  const smtpIntegration = activeIntegrations.find(i => i.provider === "smtp");
  const gmassIntegration = activeIntegrations.find(i => i.provider === "gmass");

  if (!smtpIntegration && !gmassIntegration) {
    return { success: false, error: "No email provider (SMTP or GMass) configured. Please add one in Settings > Integrations." };
  }

  // Replace variables with mock data for test
  let html = campaign.htmlContent;
  let subject = campaign.subject;
  const mockVars: Record<string, string> = {
    "{{businessName}}": "Test Dental Clinic",
    "{{BrokenThing}}": "Missing SSL",
    "{{BrokenState}}": "Insecure",
    "{{OneLineConsequence}}": "customers will see a warning when visiting your site.",
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

  if (smtpIntegration) {
    const config = (smtpIntegration.config as Record<string, any>) || {};
    const creds = (smtpIntegration.credentials as Record<string, any>) || {};
    const host = config.smtpHost;
    const port = parseInt(config.smtpPort || "465");
    const user = config.smtpUser;
    const pass = creds.smtpPass ? decryptToken(creds.smtpPass) : "";
    
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });

    try {
      await transporter.sendMail({
        from: `"${config.fromName || session.name || "LeadFlow Test"}" <${config.fromEmail || session.email || "test@leadflow.app"}>`,
        to: testEmail,
        subject: `[TEST] ${subject}`,
        html: html
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  } else if (gmassIntegration) {
    const creds = (gmassIntegration.credentials as Record<string, any>) || {};
    const apiKey = creds.apiKey ? decryptToken(creds.apiKey) : "";
    const client = new GMassClient(apiKey);
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
  }

  return { success: true };
}
