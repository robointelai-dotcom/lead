/**
 * Async Search Worker (BullMQ)
 * ----------------------------
 * Consumes jobs from the `leadflow-search` queue and executes the
 * full lead-mining pipeline for each SearchJob row:
 *
 *   1. Transition SearchJob → PROCESSING
 *   2. Run the provider search (Google Places or Mock) with the
 *      city-sweep + concurrent details logic
 *   3. Optionally run the 4-stage email-discovery cascade on each
 *      lead that lacks an email (Google Maps → DB cache → Web Scrape
 *      → Gemini AI → OpenAI AI)
 *   4. Persist each unique lead to the `leads` table (org-scoped,
 *      de-duplicated) and record its raw payload in `SearchResult`
 *   5. Optionally fan-out an outreach dispatch to GitHub
 *   6. Transition SearchJob → COMPLETED (or FAILED)
 *
 * Every DB write is scoped by `organizationId` for strict multi-tenant
 * isolation. All network/API calls sit inside try/catch with detailed
 * console logging.
 */

import { Worker, Job } from "bullmq";
import { supabase } from "@/lib/supabase";
import {
  getLeadProvider,
  type BusinessLead,
} from "@/lib/lead-provider";
import { findEmailForLead } from "@/lib/discover-email";
import { generateGrowthReadinessReport } from "@/lib/report-generator";
import {
  normalizeEmail,
  normalizePhone,
  normalizeDomain,
  normalizeName,
  calculateQualityScore,
} from "@/lib/utils";
import { findIntegrationApiKey } from "@/lib/integrations";
import {
  getRedisOptions,
  SEARCH_QUEUE_NAME,
  type SearchJobPayload,
} from "@/lib/queue";
import { enqueueGithubDispatch } from "@/lib/workers/githubDispatcher";
import { randomUUID } from "crypto";
import { getEmailProvider } from "@/lib/email-provider";

let _searchWorker: Worker<SearchJobPayload> | null = null;


/**
 * Upsert a discovered business as a Lead row, scoped by organizationId.
 * Returns the lead id (existing or newly created), or null on failure.
 */
export async function saveLead(
  organizationId: string,
  biz: BusinessLead
): Promise<string | null> {
  try {
    const ne = normalizeEmail(biz.email);
    const np = normalizePhone(biz.phone);
    const nd = normalizeDomain(biz.website);
    const nn = normalizeName(biz.businessName);

    const orParts = [];
    if (ne) orParts.push(`normalizedEmail.eq.${ne}`);
    if (np) orParts.push(`normalizedPhone.eq.${np}`);
    if (nd) orParts.push(`normalizedDomain.eq.${nd}`);
    if (nn && biz.city) orParts.push(`and(normalizedName.eq.${nn},city.eq.${biz.city})`);

    const { data: existingRows, error: findError } =
      orParts.length > 0
        ? await supabase
            .from("leads")
            .select("id, email")
            .eq("organizationId", organizationId)
            .or(orParts.join(","))
            .limit(1)
        : { data: null, error: null };

    const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

    if (findError) throw findError;

    if (existing) {
      if (!existing.email && biz.email) {
        await supabase
          .from("leads")
          .update({ email: biz.email, normalizedEmail: ne })
          .eq("id", existing.id);
      }
      return existing.id;
    }

    const qualityScore = calculateQualityScore(biz);
    const { data: created, error: createError } = await supabase
      .from("leads")
      .insert({
        id: randomUUID(),
        organizationId,
        businessName: biz.businessName || "Unknown Business",
        category: biz.category,
        description: biz.description,
        address: biz.address,
        city: biz.city,
        state: biz.state,
        country: biz.country,
        postalCode: biz.postalCode,
        latitude: biz.latitude,
        longitude: biz.longitude,
        email: biz.email,
        phone: biz.phone,
        website: biz.website,
        facebook: biz.facebook,
        instagram: biz.instagram,
        twitter: biz.twitter,
        linkedin: biz.linkedin,
        youtube: biz.youtube,
        rating: biz.rating,
        reviewCount: biz.reviewCount,
        isVerified: biz.isVerified || false,
        isClaimed: biz.isClaimed || false,
        isOpen: biz.isOpen,
        qualityScore,
        normalizedEmail: ne,
        normalizedPhone: np,
        normalizedDomain: nd,
        normalizedName: nn,
        sourceProvider: "google-places",
        sourceId: biz.sourceId,
        sourceData: biz as unknown as object,
        updatedAt: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (createError) throw createError;
    return created.id;
  } catch (err) {
    console.error("[search-worker] failed to save lead:", err);
    return null;
  }
}

/**
 * Main worker task.
 */
export async function processSearchJob(job: Job<SearchJobPayload> | { data: SearchJobPayload; updateProgress: (p: number) => Promise<void> }) {
  const payload = job.data;
  const {
    searchJobId,
    organizationId,
    campaignId,
    niche,
    country,
    state,
    city,
    postalCode,
    radius,
    maxResults,
    minRating,
    minReviewCount,
    hasEmail,
    hasPhone,
    hasWebsite,
    autoFindEmails,
    autoDispatchToGithub,
    autoGenerateReport,
    autoSendGmassEmail,
    autoSendGmassPrompt,
  } = payload;

  console.log(
    `[search-worker] starting job ${searchJobId} for org ${organizationId}`
  );

  // Transition PENDING -> PROCESSING
  await supabase
    .from("search_jobs")
    .update({
      status: "PROCESSING",
      startedAt: new Date().toISOString(),
      errorMessage: null,
    })
    .eq("id", searchJobId)
    .eq("organizationId", organizationId);

  let senderEmail = "";
  if (payload.createdByUserId) {
    const { data: user } = await supabase.from('users').select('email').eq('id', payload.createdByUserId).maybeSingle();
    if (user?.email) senderEmail = user.email;
  }

  try {
    const provider = await getLeadProvider(organizationId);

    const searchResult = await provider.searchBusinesses({
      niche,
      country,
      state,
      city,
      postalCode,
      radius,
      maxResults: maxResults || 60,
      minRating,
      minReviewCount,
      hasEmail,
      hasPhone,
      hasWebsite,
    });

    const businesses = searchResult.businesses || [];
    console.log(
      `[search-worker] job ${searchJobId}: provider returned ${businesses.length} businesses`
    );

    // Load AI integrations once (org-scoped)
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
    let withEmail = 0;
    let withPhone = 0;
    const savedLeads: Array<{ id: string; biz: BusinessLead }> = [];

    for (const biz of businesses) {
      processed++;

      // 4-stage cascade (only if the flag is set — default true)
      if (autoFindEmails !== false && !biz.email) {
        const { email, source } = await findEmailForLead(
          organizationId,
          biz,
          geminiKey,
          openaiKey
        );
        if (email) {
          biz.email = email;
          biz.emailSource = source;
          biz.emailSources = [source || "AI"];
        }
      }

      if (biz.email) withEmail++;
      if (biz.phone) withPhone++;

      // Persist to DB and record raw
      const leadId = await saveLead(organizationId, biz);
      if (leadId) {
        saved++;
        savedLeads.push({ id: leadId, biz });
        
        if (autoGenerateReport) {
          await generateGrowthReadinessReport(organizationId, leadId, biz);
        }

        if (autoSendGmassEmail && autoSendGmassPrompt && biz.email) {
          const gmassKey = findIntegrationApiKey(integrations || [], "gmass", ["API_KEY"]);
          if (gmassKey) {
            try {
              const reportLink = `${process.env.NEXT_PUBLIC_APP_URL || "https://leadflow.app"}/api/reports/${leadId}/export?format=pdf`;
              const systemPrompt = `You are an expert cold email copywriter. The user has provided an EXACT email template with variables like {{Variable}}.
Your job is to output the final email by replacing those variables with specific, realistic insights based on the Lead Details, while keeping the rest of the template exactly the same.
If you need to guess a minor detail (like SenderName), use a generic professional placeholder if not obvious.

Lead Details:
Business Name: ${biz.businessName}
City: ${biz.city || "Unknown"}
Category: ${biz.category || "Business"}
Rating: ${biz.rating || "N/A"}
Review Count: ${biz.reviewCount || "N/A"}
Phone: ${biz.phone || "N/A"}

Template:
${autoSendGmassPrompt}

Instructions:
1. Replace {{ReportLink}} with EXACTLY: ${reportLink}
2. Extract the Subject line if it starts with "Subject: " and put it on the first line.
3. Output the raw text of the final email. No markdown formatting.`;

              let generatedText = "";
              if (openaiKey) {
                try {
                  const res = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
                    body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: systemPrompt }], temperature: 0.7, max_tokens: 300 }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    generatedText = data.choices?.[0]?.message?.content?.trim() || "";
                  }
                } catch (e) {}
              }
              if (!generatedText && geminiKey) {
                try {
                  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 300 } }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    generatedText = data.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text?.trim() || "";
                  }
                } catch (e) {}
              }

              if (generatedText) {
                let subject = `AI Growth Report for ${biz.businessName}`;
                let body = generatedText;
                
                // Parse out "Subject: " and "Message: " if they exist
                const lines = generatedText.split('\n');
                if (lines[0].toLowerCase().startsWith("subject:")) {
                  subject = lines[0].replace(/subject:\s*/i, '').trim();
                  body = lines.slice(1).join('\n').trim();
                  if (body.toLowerCase().startsWith("message:")) {
                    body = body.replace(/message:\s*/i, '').trim();
                  }
                }
                
                const finalBody = body.replace(/\n/g, '<br>');
                
                const emailProvider = getEmailProvider(gmassKey, true);
                const sendRes = await emailProvider.sendEmail({
                  to: biz.email,
                  subject: subject,
                  html: finalBody,
                  from: senderEmail || undefined
                });
                
                if (sendRes.status === "failed") {
                  console.error(`[search-worker] Auto-send GMass email FAILED to ${biz.email}:`, sendRes.error);
                } else {
                  console.log(`[search-worker] Auto-sent GMass email to ${biz.email} (${sendRes.messageId})`);
                }
              }
            } catch (err) {
              console.error("[search-worker] Failed to auto-send GMass email:", err);
            }
          }
        }

        try {
          await supabase.from("search_results").insert({
            id: randomUUID(),
            searchJobId,
            leadId,
            rawData: biz as unknown as object,
            isDuplicate: false,
          });
        } catch (err) {
          console.error("[search-worker] failed to record SearchResult:", err);
        }

        // Auto-attach to campaign if provided
        if (campaignId) {
          try {
            await supabase.from("campaign_leads").upsert(
              { id: randomUUID(), campaignId, leadId, status: "NEW", updatedAt: new Date().toISOString() },
              { onConflict: "campaignId,leadId" }
            );
          } catch (err) {
            console.error(
              "[search-worker] failed to attach lead to campaign:",
              err
            );
          }
        }
      } else {
        duplicates++;
      }

      // Update progress every 2 items so the UI updates frequently and doesn't look frozen
      if (processed % 2 === 0 || processed === businesses.length) {
        try {
          // Check if user cancelled the automation
          const { data: currentJob } = await supabase
            .from("search_jobs")
            .select("status")
            .eq("id", searchJobId)
            .eq("organizationId", organizationId)
            .single();
            
          if (currentJob?.status === "CANCELLED") {
            console.log(`[search-worker] Job ${searchJobId} was CANCELLED by user. Aborting...`);
            return { saved, duplicates, processed, cancelled: true };
          }

          await supabase
            .from("search_jobs")
            .update({
              totalProcessed: processed,
              totalFound: saved,
              totalDuplicates: duplicates,
              totalWithEmail: withEmail,
              totalWithPhone: withPhone,
              updatedAt: new Date().toISOString(),
            })
            .eq("id", searchJobId)
            .eq("organizationId", organizationId);

          if ("updateProgress" in job && typeof job.updateProgress === "function") {
            await job.updateProgress(
              Math.round((processed / businesses.length) * 100)
            );
          }
        } catch (err) {
          console.error("[search-worker] progress update failed:", err);
        }
      }
    }

    // Usage tracking (org-scoped)
    try {
      const period = new Date().toISOString().slice(0, 7);
      const { data: usage } = await supabase
        .from("usage_records")
        .select("*")
        .eq("organizationId", organizationId)
        .eq("period", period)
        .maybeSingle();

      if (usage) {
        await supabase
          .from("usage_records")
          .update({
            searchesUsed: (usage.searchesUsed || 0) + 1,
            leadsStored: (usage.leadsStored || 0) + saved,
          })
          .eq("id", usage.id);
      } else {
        await supabase.from("usage_records").insert({
          id: randomUUID(),
          organizationId,
          period,
          searchesUsed: 1,
          leadsStored: saved,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error("[search-worker] usage tracking failed:", err);
    }

    // Final state
    await supabase
      .from("search_jobs")
      .update({
        status: "COMPLETED",
        completedAt: new Date().toISOString(),
        totalProcessed: processed,
        totalFound: saved,
        totalDuplicates: duplicates,
        totalWithEmail: withEmail,
        totalWithPhone: withPhone,
        usageConsumed: searchResult.usageConsumed || saved,
      })
      .eq("id", searchJobId)
      .eq("organizationId", organizationId);

    // Optional GitHub fan-out
    if (autoDispatchToGithub && savedLeads.length > 0) {
      try {
        await enqueueGithubDispatch({
          organizationId,
          searchJobId,
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
            rating: biz.rating,
            reviewCount: biz.reviewCount,
          })),
        });
      } catch (err) {
        console.error("[search-worker] enqueue dispatch failed:", err);
      }
    }

    console.log(
      `[search-worker] job ${searchJobId} COMPLETED — saved=${saved} dup=${duplicates}`
    );
    return { saved, duplicates, processed };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[search-worker] job ${searchJobId} FAILED:`, msg);

    try {
      await supabase
        .from("search_jobs")
        .update({
          status: "FAILED",
          completedAt: new Date().toISOString(),
          errorMessage: msg.slice(0, 500),
        })
        .eq("id", searchJobId)
        .eq("organizationId", organizationId);
    } catch (updateErr) {
      console.error("[search-worker] failed to mark job failed:", updateErr);
    }

    throw err;
  }
}

/**
 * Start (or return existing) BullMQ Worker instance.
 */
export function startSearchWorker(): Worker<SearchJobPayload> {
  if (_searchWorker) return _searchWorker;

  _searchWorker = new Worker<SearchJobPayload>(
    SEARCH_QUEUE_NAME,
    processSearchJob,
    {
      connection: getRedisOptions(),
      concurrency: 2,
    }
  );

  _searchWorker.on("failed", (job, err) => {
    console.error(
      `[search-worker] job ${job?.id} threw:`,
      err.message
    );
  });
  _searchWorker.on("completed", (job) => {
    console.log(`[search-worker] job ${job.id} completed cleanly`);
  });
  _searchWorker.on("ready", () => {
    console.log("[search-worker] ready and listening for jobs");
  });

  return _searchWorker;
}
