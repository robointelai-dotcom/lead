import { supabase } from "@/lib/supabase";
import { GMassClient } from "@/lib/gmass-client";
import { findIntegrationApiKey } from "@/lib/integrations";

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

    // 2. Fetch GMass API Key
    const { data: integrations } = await supabase
      .from("integrations")
      .select("*")
      .eq("organizationId", organizationId);

    const gmassKey = findIntegrationApiKey(integrations || [], "gmass", ["API_KEY"]);
    if (!gmassKey) {
      await supabase.from("email_campaigns").update({ status: "PAUSED" }).eq("id", campaignId);
      throw new Error(`GMass integration not configured for org ${organizationId}`);
    }

    const client = new GMassClient(gmassKey);

    // 3. Fetch Organization (for sender info)
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

      const res = await client.sendEmail({
        to: lead.email,
        fromEmail: "outreach@leadflow.app",
        fromName: org?.name || "LeadFlow Partner",
        subject: subject,
        html: html
      });

      if (res.success) {
        sentCount++;
        // Mark lead as contacted
        await supabase.from("campaign_leads").update({ status: "CONTACTED" }).eq("campaignId", targetCampaignId).eq("leadId", lead.id);
        
        // Log email
        await supabase.from("email_logs").insert({
          organizationId,
          leadId: lead.id,
          campaignId: targetCampaignId, 
          provider: "gmass",
          messageId: res.messageId,
          status: "SENT",
          subject,
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
