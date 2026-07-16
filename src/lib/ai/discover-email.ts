import { findEmailWithGemini, GeminiProviderError } from "./gemini-provider";
import { findEmailWithOpenAI, OpenAIProviderError } from "./openai-provider";
import { IntegrationCredentialError } from "@/lib/integrations/credentials";
import { prisma } from "@/lib/prisma";
import { normalizeDomain, normalizePhone } from "@/lib/utils";
import { scrapeEmailFromWebsite } from "@/lib/lead-provider";

export interface DiscoveryResult {
  email?: string;
  source?: string;
  success: boolean;
  error?: string;
}

/**
 * Unified discovery pipeline to find emails.
 * 1. DB Cache
 * 2. Web Scrape
 * 3. Gemini (Power AI)
 * 4. OpenAI (Critical AI)
 */
export async function discoverEmail(
  organizationId: string,
  businessName: string,
  website: string,
  phone: string,
  sourceId?: string
): Promise<DiscoveryResult> {
  // 1. DB Cache
  const nd = normalizeDomain(website);
  const np = normalizePhone(phone);
  try {
    if (nd || np || sourceId) {
      const existing = await prisma.lead.findFirst({
        where: {
          organizationId,
          OR: [
            sourceId ? { sourceId } : {},
            nd ? { normalizedDomain: nd } : {},
            np ? { normalizedPhone: np } : {},
          ].filter((c) => Object.keys(c).length > 0),
        },
        select: { email: true },
      });
      if (existing?.email) {
        return { success: true, email: existing.email, source: "Database" };
      }
    }
  } catch (err) {
    console.error("[Discovery] DB cache lookup failed:", err);
  }

  // 2. Web Scrape
  if (website) {
    try {
      const scraped = await scrapeEmailFromWebsite(website);
      if (scraped) {
        return { success: true, email: scraped, source: "Web Scrape" };
      }
    } catch (err) {
      console.error("[Discovery] Web scrape failed:", err);
    }
  }

  let savedAiError: string | undefined;

  // 3. Try Gemini (Power AI)
  try {
    const email = await findEmailWithGemini(organizationId, businessName, website, phone);
    if (email) {
      return { success: true, email, source: "Power AI" };
    }
  } catch (err: any) {
    if (err instanceof IntegrationCredentialError) {
      savedAiError = `Power AI Configuration Error: ${err.message}`;
    } else if (err instanceof GeminiProviderError) {
      savedAiError = `Power AI Error: Invalid API Key, Quota, or Model issue: ${err.status}`;
    } else {
      savedAiError = `Power AI Failed: ${err.message}`;
    }
    console.error(`[Discovery] Gemini Failed: ${savedAiError}`);
  }

  // 2. Try OpenAI (Critical AI) as fallback
  try {
    const email = await findEmailWithOpenAI(organizationId, businessName, website, phone);
    if (email) {
      return { success: true, email, source: "Critical AI" };
    }
  } catch (err: any) {
    let openaiError: string;
    if (err instanceof IntegrationCredentialError) {
      openaiError = `Critical AI Configuration Error: ${err.message}`;
    } else if (err instanceof OpenAIProviderError) {
      openaiError = `Critical AI Error: Invalid API Key or Billing issue: ${err.status}`;
    } else {
      openaiError = `Critical AI Failed: ${err.message}`;
    }
    console.error(`[Discovery] OpenAI Failed: ${openaiError}`);
    
    // Prioritize showing the OpenAI error if we hit it, since it was the final attempt
    return { success: false, error: openaiError };
  }

  // 3. Neither found an email
  return {
    success: false,
    error: savedAiError || "AI could not find a verified email for this business.",
  };
}
