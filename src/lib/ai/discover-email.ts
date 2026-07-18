import { findEmailWithGemini, GeminiProviderError } from "./gemini-provider";
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

const POWER_AI_COOLDOWN_MS = 10 * 60 * 1000;
const powerAiUnavailableUntilByOrg = new Map<string, number>();

/**
 * Unified discovery pipeline to find emails.
 * 1. DB Cache
 * 2. Web Scrape
 * 3. Gemini (Power AI)
 */
export async function discoverEmail(
  organizationId: string,
  businessName: string,
  website: string,
  phone: string,
  sourceId?: string,
  address?: string
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

  // 2. Web Scrape. If this finds an email, skip paid AI completely.
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

  const powerAiUnavailableUntil = powerAiUnavailableUntilByOrg.get(organizationId) || 0;
  if (powerAiUnavailableUntil > Date.now()) {
    errors.push("Power AI Error: Google Gemini credits are depleted or quota is exhausted. Add credits in Google AI Studio or save a new Gemini key.");
  } else {
    // 3. Power AI. This is the only paid AI fallback.
    try {
      const email = await findEmailWithGemini(organizationId, businessName, website, phone, address);
      if (email) {
        return { success: true, email, source: "Power AI" };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isQuotaOrBilling =
        err instanceof GeminiProviderError &&
        (err.status === 429 ||
          /prepayment credits|quota|billing|resource_exhausted/i.test(message));
      const error = isQuotaOrBilling
        ? "Power AI Error: Google Gemini credits are depleted or quota is exhausted. Add credits in Google AI Studio or save a new Gemini key."
        : err instanceof IntegrationCredentialError
          ? `Power AI Configuration Error: ${message}`
          : err instanceof GeminiProviderError
            ? `Power AI Error: ${message}`
            : `Power AI Failed: ${message}`;
      if (isQuotaOrBilling) {
        powerAiUnavailableUntilByOrg.set(organizationId, Date.now() + POWER_AI_COOLDOWN_MS);
      }
      console.error(`[Discovery] Gemini Failed: ${error}`);
      errors.push(error);
    }
  }

  return {
    success: false,
    error:
      errors.find((error) => error.startsWith("Power AI")) ||
      "No verified email found by web scrape or Power AI.",
  };
}
