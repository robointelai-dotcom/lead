import { Worker, Job } from "bullmq";
import { supabase } from "@/lib/supabase";
import { findIntegrationApiKey } from "@/lib/integrations";
import {
  getRedisOptions,
  IMPORT_QUEUE_NAME,
  type ImportJobPayload,
} from "@/lib/queue";
import { findEmailForLead, saveLead } from "./searchWorker";
import { enqueueGithubDispatch } from "./githubDispatcher";
import type { BusinessLead } from "@/lib/lead-provider";

let _importWorker: Worker<ImportJobPayload> | null = null;

async function processImportJob(job: Job<ImportJobPayload>) {
  const { organizationId, campaignId, leads, jobId, autoDispatchToGithub } = job.data;

  console.log(`[import-worker] starting job for org ${organizationId}, campaign ${campaignId}`);

  if (jobId) {
    await supabase
      .from("search_jobs")
      .update({ status: "PROCESSING", startedAt: new Date().toISOString() })
      .eq("id", jobId);
  }

  // Load AI integrations
  const { data: integrations = [] } = await supabase
    .from("integrations")
    .select("*")
    .eq("organizationId", organizationId)
    .eq("isActive", true);

  const geminiKey = findIntegrationApiKey(integrations || [], "gemini", [
    "GEMINI_API_KEY",
    "GOOGLE_GEMINI_API_KEY",
  ]);
  const openaiKey = findIntegrationApiKey(integrations || [], "openai", [
    "OPENAI_API_KEY",
  ]);

  let processed = 0;
  let saved = 0;
  let duplicates = 0;
  const savedLeads: Array<{ id: string; biz: BusinessLead }> = [];

  for (const rawLead of leads) {
    processed++;
    
    // Normalize raw lead from CSV to BusinessLead format
    const biz: BusinessLead = {
      businessName: rawLead.businessName || rawLead.company || rawLead.name || rawLead.BusinessName,
      email: rawLead.email || rawLead.Email,
      phone: rawLead.phone || rawLead.telephone || rawLead.Phone,
      website: rawLead.website || rawLead.url || rawLead.Website,
      address: rawLead.address || rawLead.Address,
      city: rawLead.city || rawLead.City,
      state: rawLead.state || rawLead.province || rawLead.State,
      country: rawLead.country || "US",
      category: rawLead.category || rawLead.industry || rawLead.Niche || rawLead.Category,
      rating: parseFloat(rawLead.rating) || undefined,
      reviewCount: parseInt(rawLead.reviews || rawLead.ReviewCount, 10) || undefined,
      sourceId: rawLead.sourceId || `csv-${Date.now()}-${processed}`,
    };

    if (!biz.businessName) continue;

    // 1. Try to find email if missing
    if (!biz.email) {
      const { email, source } = await findEmailForLead(
        organizationId,
        biz,
        geminiKey,
        openaiKey
      );
      if (email) {
        biz.email = email;
        biz.emailSource = source;
      }
    }

    // 2. Save lead
    const leadId = await saveLead(organizationId, biz);
    if (leadId) {
      saved++;
      savedLeads.push({ id: leadId, biz });

      // 3. Attach to campaign
      await supabase.from("campaign_leads").upsert(
        { campaignId, leadId, status: "NEW" },
        { onConflict: "campaignId,leadId" }
      );
    } else {
      duplicates++;
    }

    // Update progress
    if (processed % 10 === 0) {
      await job.updateProgress(Math.round((processed / leads.length) * 100));
      if (jobId) {
        await supabase
          .from("search_jobs")
          .update({ totalProcessed: processed, totalFound: saved })
          .eq("id", jobId);
      }
    }
  }

  if (jobId) {
    await supabase
      .from("search_jobs")
      .update({ 
        status: "COMPLETED", 
        completedAt: new Date().toISOString(),
        totalProcessed: processed,
        totalFound: saved,
        totalDuplicates: duplicates
      })
      .eq("id", jobId);
  }

  // 4. Optional GitHub fan-out
  if (autoDispatchToGithub && savedLeads.length > 0) {
    try {
      await enqueueGithubDispatch({
        organizationId,
        searchJobId: jobId,
        eventType: "leadflow_outreach_trigger",
        leads: savedLeads.map(({ id, biz }) => ({
          id,
          businessName: biz.businessName,
          email: biz.email,
          phone: biz.phone,
          website: biz.website,
          address: biz.address,
          city: biz.city,
          state: biz.state,
          country: biz.country,
          category: biz.category,
        })),
      });
    } catch (err) {
      console.error("[import-worker] GitHub dispatch failed:", err);
    }
  }

  console.log(`[import-worker] COMPLETED: saved ${saved}, duplicates ${duplicates}`);
  return { saved, duplicates, processed };
}

export function startImportWorker(): Worker<ImportJobPayload> {
  if (_importWorker) return _importWorker;

  _importWorker = new Worker<ImportJobPayload>(
    IMPORT_QUEUE_NAME,
    processImportJob,
    {
      connection: getRedisOptions(),
      concurrency: 1,
    }
  );

  return _importWorker;
}
