"use server";

import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireSession } from "@/lib/auth";
import { getLeadProvider, scrapeEmailFromWebsite, type BusinessLead } from "@/lib/lead-provider";
import {
  normalizeEmail, normalizePhone, normalizeDomain, normalizeName, calculateQualityScore
} from "@/lib/utils";
import { askGeminiForEmail, askOpenAIForEmail } from "@/lib/lead-provider";
import { findIntegrationApiKey } from "@/lib/integrations";
import { getSearchQueue } from "@/lib/queue";
import { revalidatePath } from "next/cache";

const searchSchema = z.object({
  niche: z.string().optional(),
  country: z.string().default("US"),
  state: z.string().optional(),
  city: z.string().optional(),
  maxResults: z.coerce.number().min(1).max(500).default(60),
  pageToken: z.string().optional(),
});

export type SearchActionState = {
  success: boolean;
  error?: string;
  results?: BusinessLead[];
  nextPageToken?: string;
  searchParams?: z.infer<typeof searchSchema>;
};

type EmailFinderResult =
  | { success: true; email: string; source: string }
  | { success: false; error?: string };

export async function searchGooglePlacesAction(
  _prev: SearchActionState,
  formData: FormData
): Promise<SearchActionState> {
  const session = await requireSession();

  const raw = Object.fromEntries(formData.entries());
  const parsed = searchSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "Invalid search parameters" };
  }

  try {
    const provider = await getLeadProvider(session.organizationId);
    
    // Update usage tracking
    const period = new Date().toISOString().slice(0, 7);
    const { data: usage, error: usageFetchError } = await supabase
      .from("usage_records")
      .select("searchesUsed")
      .eq("organizationId", session.organizationId)
      .eq("period", period)
      .maybeSingle();

    if (usageFetchError) throw usageFetchError;

    if (usage) {
      await supabase
        .from("usage_records")
        .update({ searchesUsed: usage.searchesUsed + 1 })
        .eq("organizationId", session.organizationId)
        .eq("period", period);
    } else {
      await supabase
        .from("usage_records")
        .insert({ organizationId: session.organizationId, period, searchesUsed: 1 });
    }

    const results = await provider.searchBusinesses(parsed.data);
    
    return { 
      success: true, 
      results: JSON.parse(JSON.stringify(results.businesses)),
      searchParams: parsed.data,
    };
  } catch (err) {
    console.error(err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to search" };
  }
}

export async function saveLeadAction(bizStr: string, campaignId: string) {
  const session = await requireSession();
  const biz = JSON.parse(bizStr);

  try {
    const ne = normalizeEmail(biz.email);
    const np = normalizePhone(biz.phone);
    const nd = normalizeDomain(biz.website);
    const nn = normalizeName(biz.businessName);
    
    // Check for existing lead
    const conditions = [
      ne ? `normalizedEmail.eq.${ne}` : null,
      np ? `normalizedPhone.eq.${np}` : null,
      nd ? `normalizedDomain.eq.${nd}` : null,
      (nn && biz.city) ? `and(normalizedName.eq."${nn}",city.eq."${biz.city}")` : null,
    ].filter(Boolean);

    let existing = null;
    if (conditions.length > 0) {
      const { data, error: fetchError } = await supabase
        .from("leads")
        .select("id, email, normalizedEmail, phone, website")
        .eq("organizationId", session.organizationId)
        .or(conditions.join(","))
        .maybeSingle();
      
      if (fetchError) throw fetchError;
      existing = data;
    }

    let leadId = existing?.id;

    if (!leadId) {
      const qualityScore = calculateQualityScore(biz);
      const { data: lead, error: insertError } = await supabase
        .from("leads")
        .insert({
          organizationId: session.organizationId,
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
          sourceData: biz,
        })
        .select("id")
        .single();
      
      if (insertError) throw insertError;
      leadId = lead.id;
    } else if (existing) {
      // If lead exists, update it with any new information (like newly found email)
      const updateData: {
        email?: string;
        normalizedEmail?: string;
        phone?: string;
        website?: string;
      } = {};
      if (biz.email && !existing.email) updateData.email = biz.email;
      if (ne && !existing.normalizedEmail) updateData.normalizedEmail = ne;
      if (biz.phone && !existing.phone) updateData.phone = biz.phone;
      if (biz.website && !existing.website) updateData.website = biz.website;
      
      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from("leads")
          .update(updateData)
          .eq("id", leadId);
        
        if (updateError) throw updateError;
      }
    }

    // Link to campaign
    const { error: upsertError } = await supabase
      .from("campaign_leads")
      .upsert({ campaignId, leadId, status: "NEW" }, { onConflict: "campaignId,leadId" });

    if (upsertError) throw upsertError;

    revalidatePath("/leads");
    revalidatePath(`/campaigns/${campaignId}`);
    return { success: true, leadId };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Failed to save lead" };
  }
}

export async function findEmailAction(bizStr: string): Promise<EmailFinderResult> {
  const session = await requireSession();
  const biz = JSON.parse(bizStr);

  try {
    // 1. Check if email already exists in the provided lead (Google Map)
    if (biz.email) {
      return { success: true, email: biz.email, source: "Google Map" };
    }

    // 1.5. Speed Check: Check if we already have this lead in our database with an email
    const bizName = biz.businessName || biz.name;
    const bizWebsite = biz.website || "";
    const bizPhone = biz.phone || biz.formatted_phone_number || "";
    const bizAddress = biz.address || biz.formatted_address || "";

    const bizDomain = normalizeDomain(bizWebsite);
    const bizNormalizedPhone = normalizePhone(bizPhone);
    
    const conditions = [
      biz.sourceId ? `sourceId.eq."${biz.sourceId}"` : null,
      bizDomain ? `normalizedDomain.eq."${bizDomain}"` : null,
      bizNormalizedPhone ? `normalizedPhone.eq."${bizNormalizedPhone}"` : null,
    ].filter(Boolean);

    let existingLead = null;
    if (conditions.length > 0) {
      const { data, error: fetchError } = await supabase
        .from("leads")
        .select("email")
        .eq("organizationId", session.organizationId)
        .or(conditions.join(","))
        .maybeSingle();
      
      if (fetchError) throw fetchError;
      existingLead = data;
    }

    if (existingLead?.email) {
      return { success: true, email: existingLead.email, source: "Database" };
    }

    // 2. Web Scrape
    if (bizWebsite) {
      const scrapedEmail = await scrapeEmailFromWebsite(bizWebsite);
      if (scrapedEmail) return { success: true, email: scrapedEmail, source: "Web Scrape" };
    }

    // Prepare for AI
    const { data: integrations, error: intError } = await supabase
      .from("integrations")
      .select("*")
      .eq("organizationId", session.organizationId)
      .eq("isActive", true);
    
    if (intError) throw intError;
    
    const geminiApiKey = findIntegrationApiKey(integrations, "gemini", [
      "GEMINI_API_KEY",
      "GOOGLE_GEMINI_API_KEY",
    ]);
    const openaiApiKey = findIntegrationApiKey(integrations, "openai", [
      "OPENAI_API_KEY",
    ]);

    if (!geminiApiKey && !openaiApiKey) {
      return { success: false, error: "No AI integration is active. Please connect Gemini or OpenAI in Settings > Integrations." };
    }

    // 3. Power AI (Gemini)
    if (geminiApiKey) {
      try {
        const email = await askGeminiForEmail(geminiApiKey, bizName, bizWebsite, bizPhone, bizAddress);
        if (email) return { success: true, email, source: "Power AI" };
      } catch (err) {
        console.error("Power AI failed:", err);
      }
    }

    // 4. Critical AI (OpenAI)
    if (openaiApiKey) {
      try {
        const email = await askOpenAIForEmail(openaiApiKey, bizName, bizWebsite, bizPhone, bizAddress);
        if (email) return { success: true, email, source: "Critical AI" };
      } catch (err) {
        console.error("Critical AI failed:", err);
      }
    }

    return { success: false, error: "AI could not find a verified email for this business." };
  } catch (err) {
    console.error(err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to find email" };
  }
}

// ─── Async Background Search (BullMQ) ────────────────────────────────────────

const enqueueSchema = z.object({
  niche: z.string().optional(),
  country: z.string().default("US"),
  state: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  maxResults: z.coerce.number().min(1).max(500).default(60),
  minRating: z.coerce.number().optional(),
  minReviewCount: z.coerce.number().optional(),
  hasEmail: z.coerce.boolean().optional(),
  hasPhone: z.coerce.boolean().optional(),
  hasWebsite: z.coerce.boolean().optional(),
  campaignId: z.string().optional(),
  autoFindEmails: z.coerce.boolean().default(true),
  autoDispatchToGithub: z.coerce.boolean().default(false),
});

export type EnqueueSearchResult =
  | { success: true; searchJobId: string }
  | { success: false; error: string };

/**
 * Create a `SearchJob` row (PENDING) and enqueue it on BullMQ.
 * The heavy lifting is done in the background by `searchWorker.ts`.
 */
export async function enqueueSearchJobAction(
  _prev: EnqueueSearchResult,
  formData: FormData
): Promise<EnqueueSearchResult> {
  const session = await requireSession();

  const raw = Object.fromEntries(formData.entries());
  const parsed = enqueueSchema.safeParse({
    ...raw,
    hasEmail: raw.hasEmail === "true",
    hasPhone: raw.hasPhone === "true",
    hasWebsite: raw.hasWebsite === "true",
    // Default to true if not present in form (e.g. automations page)
    autoFindEmails: raw.autoFindEmails === undefined ? true : raw.autoFindEmails === "true",
    autoDispatchToGithub: raw.autoDispatchToGithub === "true",
  });

  if (!parsed.success) {
    return { success: false, error: "Invalid search parameters" };
  }

  try {
    const data = parsed.data;

    const { data: searchJob, error: insertError } = await supabase
      .from("search_jobs")
      .insert({
        organizationId: session.organizationId,
        createdByUserId: session.userId,
        campaignId: data.campaignId || null,
        niche: data.niche,
        country: data.country,
        state: data.state,
        city: data.city,
        postalCode: data.postalCode,
        maxResults: data.maxResults,
        minRating: data.minRating,
        minReviewCount: data.minReviewCount,
        hasEmail: !!data.hasEmail,
        hasPhone: !!data.hasPhone,
        hasWebsite: !!data.hasWebsite,
        status: "PENDING",
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    const queue = getSearchQueue();
    await queue.add(
      "search",
      {
        searchJobId: searchJob.id,
        organizationId: session.organizationId,
        createdByUserId: session.userId,
        campaignId: data.campaignId,
        niche: data.niche,
        country: data.country,
        state: data.state,
        city: data.city,
        postalCode: data.postalCode,
        maxResults: data.maxResults,
        minRating: data.minRating,
        minReviewCount: data.minReviewCount,
        hasEmail: data.hasEmail,
        hasPhone: data.hasPhone,
        hasWebsite: data.hasWebsite,
        autoFindEmails: data.autoFindEmails,
        autoDispatchToGithub: data.autoDispatchToGithub,
      },
      { jobId: searchJob.id }
    );

    console.log(
      `[search-actions] enqueued SearchJob ${searchJob.id} for org ${session.organizationId}`
    );

    revalidatePath("/search");
    return { success: true, searchJobId: searchJob.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[search-actions] enqueue failed:", msg);
    return { success: false, error: msg };
  }
}

export interface SearchJobStatusDTO {
  id: string;
  status: string;
  totalProcessed: number;
  totalFound: number;
  totalDuplicates: number;
  totalWithEmail: number;
  totalWithPhone: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

/**
 * Fetch the current status of a SearchJob (org-scoped).
 */
export async function getSearchJobStatusAction(
  searchJobId: string
): Promise<SearchJobStatusDTO | null> {
  const session = await requireSession();

  try {
    const { data: job, error: fetchError } = await supabase
      .from("search_jobs")
      .select(`
        id,
        status,
        totalProcessed,
        totalFound,
        totalDuplicates,
        totalWithEmail,
        totalWithPhone,
        errorMessage,
        startedAt,
        completedAt
      `)
      .eq("id", searchJobId)
      .eq("organizationId", session.organizationId)
      .maybeSingle();
    
    if (fetchError) throw fetchError;
    if (!job) return null;

    return {
      ...job,
      startedAt: job.startedAt ? new Date(job.startedAt).toISOString() : null,
      completedAt: job.completedAt ? new Date(job.completedAt).toISOString() : null,
    };
  } catch (err) {
    console.error("[search-actions] status fetch failed:", err);
    return null;
  }
}

/**
 * Fetch all lead rows produced by a completed SearchJob (org-scoped).
 */
export async function getSearchJobResultsAction(searchJobId: string) {
  const session = await requireSession();

  try {
    const { data: job, error: jobError } = await supabase
      .from("search_jobs")
      .select("id, organizationId")
      .eq("id", searchJobId)
      .eq("organizationId", session.organizationId)
      .maybeSingle();

    if (jobError) throw jobError;
    if (!job) return { success: false, error: "SearchJob not found", results: [] };

    const { data: results, error: resultsError } = await supabase
      .from("search_results")
      .select(`
        id,
        leadId,
        rawData,
        isDuplicate,
        search_jobs!inner(organizationId)
      `)
      .eq("searchJobId", searchJobId)
      .eq("search_jobs.organizationId", session.organizationId)
      .order("createdAt", { ascending: false })
      .limit(500);

    if (resultsError) throw resultsError;

    return {
      success: true,
      results: results.map((r) => ({
        id: r.id,
        leadId: r.leadId,
        rawData: r.rawData,
        isDuplicate: r.isDuplicate,
      })),
    };
  } catch (err) {
    console.error("[search-actions] results fetch failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed",
      results: [],
    };
  }
}
