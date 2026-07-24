import { supabase } from "@/lib/supabase";
import { normalizeDomain, normalizePhone } from "@/lib/utils";
import type { BusinessLead } from "@/lib/lead-provider";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const BAD_EMAIL_PARTS = [
  ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".js", ".css",
  "sentry", "wix", "example.com", "domain.com", "yourdomain", "email@",
  "name@", "test@", "user@", "noreply@", "no-reply@", "donotreply@",
  "privacy@", "abuse@", "postmaster@", "webmaster@",
];

export function normalizeEmailCandidate(value: string): string | undefined {
  const email = value
    .toLowerCase()
    .replace(/^mailto:/, "")
    .replace(/\?.*$/, "")
    .replace(/[),.;:'"\]}]+$/, "")
    .trim();

  if (!EMAIL_REGEX.test(email)) {
    EMAIL_REGEX.lastIndex = 0;
    return undefined;
  }
  EMAIL_REGEX.lastIndex = 0;

  if (BAD_EMAIL_PARTS.some((part) => email.includes(part))) return undefined;
  if (email.length > 254 || email.endsWith("@")) return undefined;

  return email;
}

export function extractEmailsFromText(text: string): string[] {
  const decoded = text
    .replace(/&#64;|&commat;|\s+\[at\]\s+|\s+\(at\)\s+/gi, "@")
    .replace(/&#46;|&period;|\s+\[dot\]\s+|\s+\(dot\)\s+/gi, ".");

  const matches = decoded.match(EMAIL_REGEX) || [];
  return Array.from(new Set(matches.map(normalizeEmailCandidate).filter(Boolean) as string[]));
}

export function scoreEmail(email: string, website?: string): number {
  let score = 0;
  const local = email.split("@")[0];

  if (/^(info|contact|hello|office|admin|support|appointments|reception|care|sales)$/.test(local)) score += 25;
  if (!BAD_EMAIL_PARTS.some((part) => email.includes(part))) score += 10;

  if (website) {
    try {
      const siteHost = new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "");
      const emailHost = email.split("@")[1].replace(/^www\./, "");
      if (siteHost === emailHost || siteHost.endsWith(`.${emailHost}`)) score += 30;
    } catch {}
  }

  if (/(gmail|outlook|hotmail|yahoo|icloud)\.com$/.test(email)) score += 5;
  return score;
}

export function bestEmailFromText(text: string, website?: string): string | undefined {
  return extractEmailsFromText(text).sort((a, b) => scoreEmail(b, website) - scoreEmail(a, website))[0];
}

type GeminiResponsePayload = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: unknown }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
};

export async function scrapeEmailFromWebsite(baseUrl: string): Promise<string | undefined> {
  const extractEmailFromHtml = (html: string) => {
    const mailtoRegex = /href=["']mailto:([^"'?]+)[^"']*["']/ig;
    const mailtoEmails: string[] = [];
    let mailtoMatch;
    while ((mailtoMatch = mailtoRegex.exec(html)) !== null) {
      const email = normalizeEmailCandidate(mailtoMatch[1]);
      if (email) mailtoEmails.push(email);
    }
    if (mailtoEmails.length > 0) {
      return mailtoEmails.sort((a, b) => scoreEmail(b, baseUrl) - scoreEmail(a, baseUrl))[0];
    }
    return bestEmailFromText(html, baseUrl);
  };

  const tryFetch = async (targetUrl: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); 
      const res = await fetch(targetUrl, { 
        signal: controller.signal, 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        } 
      });
      clearTimeout(timeoutId);
      if (res.ok) return await res.text();
    } catch {}
    return null;
  };

  console.log(`[Scraper] Scraping homepage: ${baseUrl}`);
  const html = await tryFetch(baseUrl);
  if (html) {
    const email = extractEmailFromHtml(html);
    if (email) {
      console.log(`[Scraper] Email found on homepage: ${email}`);
      return email;
    }

    try {
      const urlObj = new URL(baseUrl);
      const pathsToTry = new Set<string>();
      
      const hrefRegex = /href=["'](.*?)["']/g;
      let match;
      while ((match = hrefRegex.exec(html)) !== null) {
        const href = match[1].toLowerCase();
        if (href.includes('contact') || href.includes('about') || href.includes('support')) {
          try {
            const abs = new URL(match[1], urlObj).toString();
            if (new URL(abs).hostname === urlObj.hostname) pathsToTry.add(abs);
          } catch {}
        }
      }

      pathsToTry.add(new URL('/contact', urlObj).toString());
      pathsToTry.add(new URL('/contact-us', urlObj).toString());
      pathsToTry.add(new URL('/about', urlObj).toString());
      pathsToTry.add(new URL('/about-us', urlObj).toString());

      const topPaths = Array.from(pathsToTry).slice(0, 4);
      console.log(`[Scraper] Checking ${topPaths.length} additional pages concurrently...`);
      
      const results = await Promise.all(topPaths.map(async (p) => {
        const pageHtml = await tryFetch(p);
        if (pageHtml) {
          return extractEmailFromHtml(pageHtml);
        }
        return null;
      }));

      const foundEmail = results.find(e => e);
      if (foundEmail) {
        console.log(`[Scraper] Email found on subpage: ${foundEmail}`);
        return foundEmail;
      }
    } catch {}
  }
  return undefined;
}

export async function askGeminiForEmail(apiKey: string, name: string, website: string, phone: string, address?: string): Promise<string | undefined> {
  const addressText = address ? ` at ${address}` : "";
  const prompt = `Find the verified public contact email for the business: "${name}"${addressText}.
Official Website: ${website || "none"}
Phone: ${phone || "none"}

Steps:
1. Search Google for their official website, Facebook, or LinkedIn.
2. Find their contact email.
3. Return ONLY the email address (e.g., info@domain.com).
4. If not found, return NOT_FOUND.`;

  let attempts = 0;
  while (attempts < 2) {
    try {
      attempts++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); 
      
      console.log(`[Gemini AI] Starting search for: ${name} (Attempt ${attempts})`);
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ googleSearch: {} }],
          generationConfig: { 
            temperature: 0,
            maxOutputTokens: 100 
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.status === 429) {
        console.warn("[Gemini AI] Rate limited, retrying...");
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      if (response.ok) {
         const data = await response.json() as GeminiResponsePayload;
         const textPart = data.candidates?.[0]?.content?.parts?.find(p => typeof (p as any).text === "string")?.text as string | undefined;
         const text = typeof textPart === "string" ? textPart.trim() : undefined;
         
         console.log(`[Gemini AI] Output for ${name}: ${text}`);
         
         if (text && text !== "NOT_FOUND" && text.includes("@")) {
           const extracted = bestEmailFromText(text, website);
           if (extracted) return extracted;
         }
         break;
      } else {
         console.error(`[Gemini AI] HTTP Error: ${response.status}`, await response.text());
         break;
      }
    } catch(e) {
      console.error("[Gemini AI] Error:", e);
      if (attempts >= 2) break;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return undefined;
}

export async function askOpenAIForEmail(apiKey: string, name: string, website: string, phone: string, address?: string): Promise<string | undefined> {
  const addressText = address ? ` at ${address}` : "";
  const prompt = `You are a strict data validation assistant. Find the verified contact email for the business: "${name}"${addressText}.
Website: ${website || "none"}
Phone: ${phone || "none"}

CRITICAL INSTRUCTIONS:
- Return ONLY the exact email address.
- DO NOT guess or hallucinate. If you are not 100% certain based on known verified data, return NOT_FOUND.`;

  let attempts = 0;
  while (attempts < 2) {
    try {
      attempts++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      console.log(`[OpenAI AI] Starting search for: ${name} (Attempt ${attempts})`);
      
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 100,
          temperature: 0,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.status === 429) {
        console.warn("[OpenAI AI] Rate limited, retrying...");
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        console.log(`[OpenAI AI] Output for ${name}: ${text}`);
        if (text && text !== "NOT_FOUND" && text.includes("@")) {
          const extracted = bestEmailFromText(text, website);
          if (extracted) return extracted;
        }
        break;
      } else {
        console.error(`[OpenAI AI] HTTP Error: ${response.status}`, await response.text());
        break;
      }
    } catch (e) {
      console.error("[OpenAI AI] Error:", e);
      if (attempts >= 2) break;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return undefined;
}

export async function findEmailForLead(
  organizationId: string,
  biz: BusinessLead,
  geminiKey?: string,
  openaiKey?: string
): Promise<{ email?: string; source?: string }> {
  if (biz.email) return { email: biz.email, source: "Google Map" };

  const nd = normalizeDomain(biz.website);
  const np = normalizePhone(biz.phone);

  try {
    const orParts = [];
    if (biz.sourceId) orParts.push(`sourceId.eq.${biz.sourceId}`);
    if (nd) orParts.push(`normalizedDomain.eq.${nd}`);
    if (np) orParts.push(`normalizedPhone.eq.${np}`);

    if (orParts.length > 0) {
      const { data: existing, error } = await supabase
        .from("leads")
        .select("email")
        .eq("organizationId", organizationId)
        .or(orParts.join(","))
        .maybeSingle();

      if (error) {
         if (error.code !== 'PGRST116') {
           throw error; 
         }
      }
      if (existing?.email) {
        return { email: existing.email, source: "Database" };
      }
    }
  } catch (err) {
    console.error("[discover-email] DB cache lookup failed:", err);
    throw new Error(`Database error prevented cache lookup: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (biz.website) {
    try {
      const email = await scrapeEmailFromWebsite(biz.website);
      if (email) return { email, source: "Web Scrape" };
    } catch (err) {
      console.error("[discover-email] scrape failed:", err);
    }
  }

  if (geminiKey) {
    try {
      const email = await askGeminiForEmail(
        geminiKey,
        biz.businessName,
        biz.website || "",
        biz.phone || "",
        biz.address
      );
      if (email) return { email, source: "Power AI" };
    } catch (err) {
      console.error("[discover-email] Gemini failed:", err);
    }
  }

  if (openaiKey) {
    try {
      const email = await askOpenAIForEmail(
        openaiKey,
        biz.businessName,
        biz.website || "",
        biz.phone || "",
        biz.address
      );
      if (email) return { email, source: "Critical AI" };
    } catch (err) {
      console.error("[discover-email] OpenAI failed:", err);
    }
  }

  return {};
}
