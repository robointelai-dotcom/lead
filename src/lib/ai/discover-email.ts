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
 * 2. Web Scrape + Power AI + Critical AI in parallel
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

  type DiscoveryTask = {
    label: string;
    promise: Promise<DiscoveryResult>;
  };

  const tasks: DiscoveryTask[] = [];

  if (website) {
    tasks.push({
      label: "Web Scrape",
      promise: scrapeEmailFromWebsite(website)
        .then((email) => email
          ? { success: true, email, source: "Web Scrape" }
          : { success: false })
        .catch((err) => {
          console.error("[Discovery] Web scrape failed:", err);
          return { success: false, error: "Web scrape failed" };
        }),
    });
  }

  tasks.push({
    label: "Power AI",
    promise: findEmailWithGemini(organizationId, businessName, website, phone)
      .then((email) => email
        ? { success: true, email, source: "Power AI" }
        : { success: false })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        const error =
          err instanceof IntegrationCredentialError
            ? `Power AI Configuration Error: ${message}`
            : err instanceof GeminiProviderError
              ? `Power AI Error: ${message}`
              : `Power AI Failed: ${message}`;
        console.error(`[Discovery] Gemini Failed: ${error}`);
        return { success: false, error };
      }),
  });

  tasks.push({
    label: "Critical AI",
    promise: findEmailWithOpenAI(organizationId, businessName, website, phone)
      .then((email) => email
        ? { success: true, email, source: "Critical AI" }
        : { success: false })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        const error =
          err instanceof IntegrationCredentialError
            ? `Critical AI Configuration Error: ${message}`
            : err instanceof OpenAIProviderError
              ? `Critical AI Error: ${message}`
              : `Critical AI Failed: ${message}`;
        console.error(`[Discovery] OpenAI Failed: ${error}`);
        return { success: false, error };
      }),
  });

  const pending = new Set(tasks);
  const errors: string[] = [];

  while (pending.size > 0) {
    const settled = await Promise.race(
      Array.from(pending).map((task) =>
        task.promise.then((result) => ({ task, result }))
      )
    );
    pending.delete(settled.task);

    if (settled.result.success && settled.result.email) {
      return settled.result;
    }

    if (settled.result.error) {
      errors.push(settled.result.error);
    }
  }

  return {
    success: false,
    error: errors.find((error) => error.startsWith("Critical AI")) ||
      errors.find((error) => error.startsWith("Power AI")) ||
      "AI could not find a verified email for this business.",
  };
}
