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
import { prisma } from "@/lib/prisma";
import {
  getLeadProvider,
  scrapeEmailFromWebsite,
  type BusinessLead,
} from "@/lib/lead-provider";
import { discoverEmail } from "@/lib/ai/discover-email";
import {
  normalizeEmail,
  normalizePhone,
  normalizeDomain,
  normalizeName,
  calculateQualityScore,
} from "@/lib/utils";
import { decryptToken } from "@/lib/crypto";
import {
  getRedisOptions,
  SEARCH_QUEUE_NAME,
  type SearchJobPayload,
} from "@/lib/queue";
import { enqueueGithubDispatch } from "@/lib/workers/githubDispatcher";

let _searchWorker: Worker<SearchJobPayload> | null = null;





/**
 * Upsert a discovered business as a Lead row, scoped by organizationId.
 * Returns the lead id (existing or newly created), or null on failure.
 */
async function saveLead(
  organizationId: string,
  biz: BusinessLead
): Promise<string | null> {
  try {
    const ne = normalizeEmail(biz.email);
    const np = normalizePhone(biz.phone);
    const nd = normalizeDomain(biz.website);
    const nn = normalizeName(biz.businessName);

    const dedupClauses = [
      ne ? { normalizedEmail: ne } : null,
      np ? { normalizedPhone: np } : null,
      nd ? { normalizedDomain: nd } : null,
      nn && biz.city ? { normalizedName: nn, city: biz.city } : null,
    ].filter(Boolean) as Array<Record<string, unknown>>;

    const existing =
      dedupClauses.length > 0
        ? await prisma.lead.findFirst({
            where: { organizationId, OR: dedupClauses },
            select: { id: true, email: true },
          })
        : null;

    if (existing) {
      if (!existing.email && biz.email) {
        await prisma.lead.update({
          where: { id: existing.id },
          data: { email: biz.email, normalizedEmail: ne },
        });
      }
      return existing.id;
    }

    const qualityScore = calculateQualityScore(biz);
    const created = await prisma.lead.create({
      data: {
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
      },
    });
    return created.id;
  } catch (err) {
    console.error("[search-worker] failed to save lead:", err);
    return null;
  }
}

/**
 * Main worker task.
 */
async function processSearchJob(job: Job<SearchJobPayload>) {
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
  } = payload;

  console.log(
    `[search-worker] starting job ${searchJobId} for org ${organizationId}`
  );

  // Transition PENDING -> PROCESSING
  await prisma.searchJob.update({
    where: { id: searchJobId, organizationId },
    data: {
      status: "PROCESSING",
      startedAt: new Date(),
      errorMessage: null,
    },
  });

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



    let processed = 0;
    let saved = 0;
    let duplicates = 0;
    let withEmail = 0;
    let withPhone = 0;
    const savedLeads: Array<{ id: string; biz: BusinessLead }> = [];

    const BATCH_SIZE = 15; // Process up to 15 leads concurrently
    for (let i = 0; i < businesses.length; i += BATCH_SIZE) {
      const batch = businesses.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (biz) => {
        // 4-stage cascade (only if the flag is set — default true)
        if (autoFindEmails !== false && !biz.email) {
          const { email, source } = await discoverEmail(
            organizationId,
            biz.businessName,
            biz.website || "",
            biz.phone || ""
          );
          if (email) {
            biz.email = email;
            biz.emailSource = source;
            biz.emailSources = [source || "AI"];
          }
        }

        // We use an atomic counter or just recalculate at the end, but let's increment local variables safely
        // Promise.all runs concurrently, so standard increments are fine in single-threaded Node.js event loop
        processed++;
        if (biz.email) withEmail++;
        if (biz.phone) withPhone++;

        // Persist to DB and record raw
        const leadId = await saveLead(organizationId, biz);
        if (leadId) {
          saved++;
          savedLeads.push({ id: leadId, biz });

          try {
            await prisma.searchResult.create({
              data: {
                searchJobId,
                leadId,
                rawData: biz as unknown as object,
                isDuplicate: false,
              },
            });
          } catch (err) {
            console.error("[search-worker] failed to record SearchResult:", err);
          }

          // Auto-attach to campaign if provided
          if (campaignId) {
            try {
              await prisma.campaignLead.upsert({
                where: { campaignId_leadId: { campaignId, leadId } },
                update: {},
                create: { campaignId, leadId, status: "NEW" },
              });
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
      }));

      // Update progress after each batch so the UI can poll
      try {
        await prisma.searchJob.update({
          where: { id: searchJobId, organizationId },
          data: {
            totalProcessed: processed,
            totalFound: saved,
            totalDuplicates: duplicates,
            totalWithEmail: withEmail,
            totalWithPhone: withPhone,
          },
        });
        await job.updateProgress(
          Math.round((processed / businesses.length) * 100)
        );
      } catch (err) {
        console.error("[search-worker] progress update failed:", err);
      }
    }

    // Usage tracking (org-scoped)
    try {
      const period = new Date().toISOString().slice(0, 7);
      await prisma.usageRecord.upsert({
        where: { organizationId_period: { organizationId, period } },
        update: {
          searchesUsed: { increment: 1 },
          leadsStored: { increment: saved },
        },
        create: {
          organizationId,
          period,
          searchesUsed: 1,
          leadsStored: saved,
        },
      });
    } catch (err) {
      console.error("[search-worker] usage tracking failed:", err);
    }

    // Final state
    await prisma.searchJob.update({
      where: { id: searchJobId, organizationId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        totalProcessed: processed,
        totalFound: saved,
        totalDuplicates: duplicates,
        totalWithEmail: withEmail,
        totalWithPhone: withPhone,
        usageConsumed: searchResult.usageConsumed || saved,
      },
    });

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
      await prisma.searchJob.update({
        where: { id: searchJobId, organizationId },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: msg.slice(0, 500),
        },
      });
    } catch (updateErr) {
      console.error(
        "[search-worker] failed to mark job failed:",
        updateErr
      );
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
