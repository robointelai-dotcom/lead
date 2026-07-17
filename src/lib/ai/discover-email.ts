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

  const errors: string[] = [];

  // 2. Web Scrape. If this finds an email, skip both AI providers.
  if (website) {
    try {
      const email = await scrapeEmailFromWebsite(website);
      if (email) {
        return { success: true, email, source: "Web Scrape" };
      }
    } catch (err) {
      console.error("[Discovery] Web scrape failed:", err);
      errors.push("Web scrape failed");
    }
  }

  // 3. Power AI. If this finds an email, skip Critical AI.
  try {
    const email = await findEmailWithGemini(organizationId, businessName, website, phone);
    if (email) {
      return { success: true, email, source: "Power AI" };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const error =
      err instanceof IntegrationCredentialError
        ? `Power AI Configuration Error: ${message}`
        : err instanceof GeminiProviderError
          ? `Power AI Error: ${message}`
          : `Power AI Failed: ${message}`;
    console.error(`[Discovery] Gemini Failed: ${error}`);
    errors.push(error);
  }

  // 4. Critical AI. Only runs after Web Scrape and Power AI fail.
  try {
    const email = await findEmailWithOpenAI(organizationId, businessName, website, phone);
    if (email) {
      return { success: true, email, source: "Critical AI" };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const error =
      err instanceof IntegrationCredentialError
        ? `Critical AI Configuration Error: ${message}`
        : err instanceof OpenAIProviderError
          ? `Critical AI Error: ${message}`
          : `Critical AI Failed: ${message}`;
    console.error(`[Discovery] OpenAI Failed: ${error}`);
    errors.push(error);
  }

  return {
    success: false,
    error: errors.find((error) => error.startsWith("Critical AI")) ||
      errors.find((error) => error.startsWith("Power AI")) ||
      "AI could not find a verified email for this business.",
  };
}
