import { supabase } from "@/lib/supabase";
import { GMassClient } from "@/lib/gmass-client";
import { findIntegrationApiKey } from "@/lib/integrations";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { decryptToken } from "@/lib/crypto";

/**
 * Directly processes the email campaign in the background without needing Redis/BullMQ.
 * Ideal for shared hosting environments like Hostinger.
 */
export async function processEmailCampaignLocally(campaignId: string, organizationId: string) {
  console.log(`[email-campaign-local] Starting processing for campaign ${campaignId}`);

  try {
    // 1. Fetch the campaign
    const { data: campaign, error: campError } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("organizationId", organizationId)
      .single();
      
    if (campError || !campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }
    
    if (campaign.status !== "SENDING") {
      console.log(`[email-campaign-local] Campaign ${campaignId} status is ${campaign.status}, skipping.`);
      return;
    }

    // 2. Fetch GMass or SMTP Integration
    const { data: integrations } = await supabase
      .from("integrations")
      .select("*")
      .eq("organizationId", organizationId)
      .eq("isActive", true);

    const activeIntegrations = integrations || [];
    const smtpIntegration = activeIntegrations.find(i => i.provider === "smtp");
    const gmassIntegration = activeIntegrations.find(i => i.provider === "gmass");

    let mailerType: "smtp" | "gmass" | null = null;
    let transporter: nodemailer.Transporter | null = null;
    let gmassClient: GMassClient | null = null;
    let fromEmail = "outreach@leadflow.app";
    let fromName = "LeadFlow Partner";

    if (smtpIntegration) {
      mailerType = "smtp";
      const config = (smtpIntegration.config as Record<string, any>) || {};
      const creds = (smtpIntegration.credentials as Record<string, any>) || {};
      const host = config.smtpHost;
      const port = parseInt(config.smtpPort || "465");
      const user = config.smtpUser;
      const pass = creds.smtpPass ? decryptToken(creds.smtpPass) : "";
      
      fromEmail = config.fromEmail || fromEmail;
      fromName = config.fromName || fromName;

      transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
      });
    } else if (gmassIntegration) {
      mailerType = "gmass";
      const creds = (gmassIntegration.credentials as Record<string, any>) || {};
      const apiKey = creds.apiKey ? decryptToken(creds.apiKey) : "";
      if (!apiKey) {
        await supabase.from("email_campaigns").update({ status: "PAUSED" }).eq("id", campaignId);
        throw new Error(`GMass API key not found for org ${organizationId}`);
      }
      gmassClient = new GMassClient(apiKey);
    } else {
      await supabase.from("email_campaigns").update({ status: "PAUSED" }).eq("id", campaignId);
      throw new Error(`No email provider configured (SMTP or GMass) for org ${organizationId}`);
    }

    // 3. Fetch Organization (for sender info fallback)
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .single();

    // 4. Fetch leads assigned to this campaign
    let targetCampaignId = campaign.campaignId;
    if (!targetCampaignId) {
      console.log(`[email-campaign-local] No target campaign specified, skipping.`);
      await supabase.from("email_campaigns").update({ status: "PAUSED" }).eq("id", campaignId);
      return;
    }

    const { data: campaignLeads, error: clError } = await supabase
      .from("campaign_leads")
      .select(`leadId`)
      .eq("campaignId", targetCampaignId)
      .eq("status", "NEW"); // Only send to new/uncontacted leads

    if (clError) {
      console.error(`[email-campaign-local] Error fetching campaign leads:`, clError);
      return;
    }

    if (!campaignLeads || campaignLeads.length === 0) {
      console.log(`[email-campaign-local] No eligible leads found for campaign ${campaignId}`);
      await supabase.from("email_campaigns").update({ status: "COMPLETED" }).eq("id", campaignId);
      return;
    }

    let sentCount = campaign.totalSent || 0;
    let limit = campaign.sendingLimit || 50;
    let delayMs = campaign.delayBetweenMs || 1000;

    const leadsToProcess = campaignLeads.slice(0, limit);
    const leadIds = leadsToProcess.map(cl => cl.leadId);
    
    const { data: leadsData } = await supabase
      .from("leads")
      .select("*")
      .in("id", leadIds);

    if (!leadsData || leadsData.length === 0) return;

    for (const lead of leadsData) {
      if (!lead.email) continue;
      
      // Ensure we check if it was paused during execution
      const { data: currentCamp } = await supabase
        .from("email_campaigns")
        .select("status")
        .eq("id", campaignId)
        .single();
        
      if (currentCamp?.status !== "SENDING") {
        console.log(`[email-campaign-local] Campaign ${campaignId} paused, stopping batch.`);
        break;
      }

      console.log(`[email-campaign-local] Sending to ${lead.email} for campaign ${campaignId}`);
      
      let html = campaign.htmlContent;
      let subject = campaign.subject;
      
      const mockVars: Record<string, string> = {
        "{{PracticeName}}": lead.businessName || "Your Business",
        "{{BrokenThing}}": "Website issue",
        "{{BrokenState}}": "needs attention",
        "{{OneLineConsequence}}": "You might be losing customers.",
        "{{SecondFinding}}": "missing SEO tags",
        "{{ThirdFinding}}": "slow page load",
        "{{ReviewCount}}": (lead.reviewCount || 0).toString(),
        "{{Rating}}": (lead.rating || 5.0).toString(),
        "{{ReportLink}}": `${process.env.NEXT_PUBLIC_APP_URL || "https://leadflow.app"}/api/reports/${lead.id}/export?format=pdf`,
        "{{SenderName}}": "Growth Partner",
        "{{Company}}": org?.name || "Our Agency",
        "{{Phone}}": lead.phone || "your contact number",
        "{{PostalAddress}}": lead.address || "your business location",
        "{{UnsubscribeLink}}": "#"
      };

      Object.entries(mockVars).forEach(([k, v]) => {
        const regex = new RegExp(k.replace(/[{}]/g, '\\$&'), 'gi');
        html = html.replace(regex, v);
        subject = subject.replace(regex, v);
      });

      let res: { success: boolean; messageId?: string; errorMessage?: string } = { success: false };
      
      if (mailerType === "smtp" && transporter) {
        fromName = fromName === "LeadFlow Partner" ? (org?.name || fromName) : fromName;
        
        const mailOptions = {
          from: `"${fromName}" <${fromEmail}>`,
          to: lead.email,
          subject: subject,
          html: html
        };
        
        try {
          const info = await transporter.sendMail(mailOptions);
          res = { success: true, messageId: info.messageId || crypto.randomUUID() };
        } catch (err: any) {
          res = { success: false, errorMessage: err.message };
        }
      } else if (mailerType === "gmass" && gmassClient) {
        fromName = org?.name || "LeadFlow Partner";
        res = await gmassClient.sendEmail({
          to: lead.email,
          fromEmail,
          fromName,
          subject: subject,
          html: html
        });
      }

      if (res.success) {
        sentCount++;
        // Mark lead as contacted
        await supabase.from("campaign_leads").update({ status: "CONTACTED" }).eq("campaignId", targetCampaignId).eq("leadId", lead.id);
        
        // Log email
        await supabase.from("email_messages").insert({
          leadId: lead.id,
          campaignId: targetCampaignId, 
          provider: mailerType || "unknown",
          providerMessageId: res.messageId,
          idempotencyKey: res.messageId || crypto.randomUUID(),
          recipientEmail: lead.email,
          senderEmail: fromEmail,
          subject,
          status: "SENT",
          sentAt: new Date().toISOString()
        });
        
        // Update campaign stats
        await supabase.from("email_campaigns").update({ totalSent: sentCount }).eq("id", campaignId);
      } else {
        console.error(`[email-campaign-local] Failed to send to ${lead.email}: ${res.errorMessage}`);
      }

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    // Check if we finished all leads
    const { data: remainingLeads } = await supabase
      .from("campaign_leads")
      .select("leadId")
      .eq("campaignId", targetCampaignId)
      .eq("status", "NEW");

    if (!remainingLeads || remainingLeads.length === 0) {
      await supabase.from("email_campaigns").update({ status: "COMPLETED" }).eq("id", campaignId);
    } else {
      // Re-trigger the next batch in the background
      console.log(`[email-campaign-local] Re-triggering next batch for ${campaignId}`);
      setTimeout(() => processEmailCampaignLocally(campaignId, organizationId), 1000);
    }
  } catch (err) {
    console.error(`[email-campaign-local] Fatal error processing campaign ${campaignId}:`, err);
  }
}
