"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { getLeadProvider, scrapeEmailFromWebsite, type BusinessLead } from "@/lib/lead-provider";
import {
  normalizeEmail, normalizePhone, normalizeDomain, normalizeName, calculateQualityScore
} from "@/lib/utils";
import { askGeminiForEmail, askOpenAIForEmail } from "@/lib/lead-provider";
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

function getIntegrationApiKey(credentials: unknown): string | undefined {
  if (!credentials || typeof credentials !== "object" || !("apiKey" in credentials)) return undefined;
  const apiKey = (credentials as { apiKey?: unknown }).apiKey;
  return typeof apiKey === "string" && apiKey.trim() ? apiKey : undefined;
}

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
    await prisma.usageRecord.upsert({
      where: { organizationId_period: { organizationId: session.organizationId, period } },
      update: { searchesUsed: { increment: 1 } },
      create: { organizationId: session.organizationId, period, searchesUsed: 1 },
    });

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
    const existing = await prisma.lead.findFirst({
      where: {
        organizationId: session.organizationId,
        OR: [
          ne ? { normalizedEmail: ne } : {},
          np ? { normalizedPhone: np } : {},
          nd ? { normalizedDomain: nd } : {},
          (nn && biz.city) ? { normalizedName: nn, city: biz.city } : {},
        ].filter((c) => Object.keys(c).length > 0),
      },
      select: {
        id: true,
        email: true,
        normalizedEmail: true,
        phone: true,
        website: true,
      }
    });

    let leadId = existing?.id;

    if (!leadId) {
      const qualityScore = calculateQualityScore(biz);
      const lead = await prisma.lead.create({
        data: {
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
        },
      });
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
        await prisma.lead.update({
          where: { id: leadId },
          data: updateData,
        });
      }
    }

    // Link to campaign
    await prisma.campaignLead.upsert({
      where: { campaignId_leadId: { campaignId, leadId } },
      update: {},
      create: { campaignId, leadId, status: "NEW" },
    });

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
    const existingLeadConditions: Array<
      { sourceId: string } | { normalizedDomain: string } | { normalizedPhone: string }
    > = [
      biz.sourceId ? { sourceId: biz.sourceId } : null,
      bizDomain ? { normalizedDomain: bizDomain } : null,
      bizNormalizedPhone ? { normalizedPhone: bizNormalizedPhone } : null,
    ].filter((condition): condition is { sourceId: string } | { normalizedDomain: string } | { normalizedPhone: string } => Boolean(condition));

    const existingLead = existingLeadConditions.length > 0
      ? await prisma.lead.findFirst({
          where: {
            organizationId: session.organizationId,
            OR: existingLeadConditions,
          },
          select: { email: true },
        })
      : null;

    if (existingLead?.email) {
      return { success: true, email: existingLead.email, source: "Database" };
    }

    // 2. Web Scrape
    if (bizWebsite) {
      const scrapedEmail = await scrapeEmailFromWebsite(bizWebsite);
      if (scrapedEmail) return { success: true, email: scrapedEmail, source: "Web Scrape" };
    }

    // Prepare for AI
    const integrations = await prisma.integration.findMany({
      where: { organizationId: session.organizationId, isActive: true },
    });
    
    const geminiIntegration = integrations.find(i => i.provider === "gemini");
    const geminiApiKey = getIntegrationApiKey(geminiIntegration?.credentials);
    const openaiIntegration = integrations.find(i => i.provider === "openai");
    const openaiApiKey = getIntegrationApiKey(openaiIntegration?.credentials);

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
