import { prisma } from "./prisma";
import { decryptToken } from "./crypto";

/**
 * Provider-agnostic Lead Provider Interface
 */

export interface BusinessSearchParams {
  niche?: string;
  country?: string;
  state?: string;
  city?: string;
  postalCode?: string;
  radius?: number;
  maxResults?: number;
  pageToken?: string;
  minRating?: number;
  minReviewCount?: number;
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasWebsite?: boolean;
  hasSocialMedia?: boolean;
  isOpen?: boolean;
  isVerified?: boolean;
  isClaimed?: boolean;
}

export interface BusinessLead {
  sourceId: string;
  businessName: string;
  category?: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  email?: string;
  emailSource?: string;
  emailSources?: string[];
  phone?: string;
  website?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
  rating?: number;
  reviewCount?: number;
  isVerified?: boolean;
  isClaimed?: boolean;
  isOpen?: boolean;
  rawData?: Record<string, unknown>;
}

export interface SearchResult {
  businesses: BusinessLead[];
  totalFound: number;
  usageConsumed: number;
  nextPageToken?: string;
}

export interface UsageInfo {
  used: number;
  limit: number;
  remaining: number;
}

export interface LeadProvider {
  name: string;
  searchBusinesses(params: BusinessSearchParams): Promise<SearchResult>;
  getBusinessDetails(sourceId: string): Promise<BusinessLead | null>;
  getUsage(): Promise<UsageInfo>;
}

// ─── Mock Lead Provider (Development) ────────────────────────────────────────

const MOCK_NICHES = ["Restaurant", "Dentist", "Plumber", "Hair Salon", "Gym", "Lawyer", "Auto Repair", "Real Estate", "Bakery", "Coffee Shop"];
const MOCK_CITIES = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose"];
const MOCK_STATES = ["NY", "CA", "IL", "TX", "AZ", "PA", "TX", "CA", "TX", "CA"];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBool(probability = 0.7): boolean {
  return Math.random() < probability;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateMockBusiness(params: BusinessSearchParams, index: number): BusinessLead {
  const niche = params.niche || randomChoice(MOCK_NICHES);
  const city = params.city || randomChoice(MOCK_CITIES);
  const stateIdx = MOCK_CITIES.indexOf(city);
  const state = params.state || (stateIdx >= 0 ? MOCK_STATES[stateIdx] : "CA");
  const country = params.country || "US";

  const names = [
    `${city} ${niche}s`, `Premium ${niche}`, `Best ${niche} Co`, `${niche} Pro`,
    `Elite ${niche}`, `Quality ${niche}`, `Local ${niche}`, `${niche} Express`,
    `Top ${niche}`, `${niche} Plus`, `${niche} Hub`, `The ${niche} Place`,
  ];

  const businessName = names[index % names.length] + (index > 11 ? ` ${Math.ceil(index / 12)}` : "");
  const hasEmail = params.hasEmail ? true : randomBool(0.6);
  const hasPhone = params.hasPhone ? true : randomBool(0.8);
  const hasWebsite = params.hasWebsite ? true : randomBool(0.5);
  const rating = randomInt(30, 50) / 10;
  const reviewCount = randomInt(5, 500);
  const slug = businessName.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");

  return {
    sourceId: `mock-${Date.now()}-${index}`,
    businessName,
    category: niche,
    description: `A quality ${niche.toLowerCase()} serving the ${city} area since ${randomInt(2000, 2020)}.`,
    address: `${randomInt(100, 9999)} ${randomChoice(["Main St", "Oak Ave", "Park Blvd", "Elm Dr", "Maple Way"])}`,
    city,
    state,
    country,
    postalCode: `${randomInt(10000, 99999)}`,
    latitude: 40 + Math.random() * 10,
    longitude: -100 - Math.random() * 30,
    email: hasEmail ? `info@${slug}.com` : undefined,
    phone: hasPhone ? `+1 (${randomInt(200, 999)}) ${randomInt(200, 999)}-${randomInt(1000, 9999)}` : undefined,
    website: hasWebsite ? `https://www.${slug}.com` : undefined,
    facebook: randomBool(0.4) ? `https://facebook.com/${slug}` : undefined,
    instagram: randomBool(0.3) ? `https://instagram.com/${slug}` : undefined,
    rating,
    reviewCount,
    isVerified: randomBool(0.4),
    isClaimed: randomBool(0.6),
    isOpen: randomBool(0.7),
  };
}

export class MockLeadProvider implements LeadProvider {
  name = "mock";

  async searchBusinesses(params: BusinessSearchParams): Promise<SearchResult> {
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 500));

    const maxResults = params.maxResults || 20;
    const businesses: BusinessLead[] = [];

    for (let i = 0; i < maxResults; i++) {
      const biz = generateMockBusiness(params, i);

      // Apply filters
      if (params.minRating && biz.rating && biz.rating < params.minRating) continue;
      if (params.minReviewCount && biz.reviewCount && biz.reviewCount < params.minReviewCount) continue;
      if (params.hasEmail && !biz.email) continue;
      if (params.hasPhone && !biz.phone) continue;
      if (params.hasWebsite && !biz.website) continue;
      if (params.isVerified && !biz.isVerified) continue;
      if (params.isClaimed && !biz.isClaimed) continue;

      businesses.push(biz);
    }

    return {
      businesses,
      totalFound: businesses.length,
      usageConsumed: businesses.length,
    };
  }

  async getBusinessDetails(sourceId: string): Promise<BusinessLead | null> {
    await new Promise((r) => setTimeout(r, 200));
    return generateMockBusiness({}, parseInt(sourceId.split("-")[2] || "0"));
  }

  async getUsage(): Promise<UsageInfo> {
    return { used: 42, limit: 1000, remaining: 958 };
  }
}

// ─── Email Discovery Helpers ──────────────────────────────────────────────────

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const AI_EMAIL_TIMEOUT_MS = 30000;

const BAD_EMAIL_PARTS = [
  ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".js", ".css",
  "sentry", "wix", "example.com", "domain.com", "yourdomain", "email@",
  "name@", "test@", "user@", "noreply@", "no-reply@", "donotreply@",
  "privacy@", "abuse@", "postmaster@", "webmaster@",
];

function normalizeEmailCandidate(value: string): string | undefined {
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

function extractEmailsFromText(text: string): string[] {
  const decoded = text
    .replace(/&#64;|&commat;|\s+\[at\]\s+|\s+\(at\)\s+/gi, "@")
    .replace(/&#46;|&period;|\s+\[dot\]\s+|\s+\(dot\)\s+/gi, ".");

  const matches = decoded.match(EMAIL_REGEX) || [];
  return Array.from(new Set(matches.map(normalizeEmailCandidate).filter(Boolean) as string[]));
}

function scoreEmail(email: string, website?: string): number {
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

function getWebsiteHost(website?: string): string | undefined {
  if (!website) return undefined;
  try {
    return new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function bestEmailFromText(text: string, website?: string): string | undefined {
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

// ─── Email Scraper Helper ─────────────────────────────────────────────────────

export async function scrapeEmailFromWebsite(baseUrl: string): Promise<string | undefined> {
  const extractEmailFromHtml = (html: string) => {
    // 1. Prioritize mailto: links
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
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s per page for lightning speed
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
      
      // Look for contact links in HTML
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

      // Brute force common paths
      pathsToTry.add(new URL('/contact', urlObj).toString());
      pathsToTry.add(new URL('/contact-us', urlObj).toString());
      pathsToTry.add(new URL('/about', urlObj).toString());
      pathsToTry.add(new URL('/about-us', urlObj).toString());

      const topPaths = Array.from(pathsToTry).slice(0, 3);
      console.log(`[Scraper] Checking ${topPaths.length} additional pages...`);
      
      const pagesHtml = await Promise.all(topPaths.map(p => tryFetch(p)));
      for (const pageHtml of pagesHtml) {
        if (pageHtml) {
          const e = extractEmailFromHtml(pageHtml);
          if (e) {
            console.log(`[Scraper] Email found on subpage: ${e}`);
            return e;
          }
        }
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
4. If not found, return exactly: NOT_FOUND.`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  // Try grounded (with Google Search tool) first. If the key doesn't have
  // grounding entitlement, retry without the tool.
  const attempts = [
    { withSearch: true,  label: "grounded" },
    { withSearch: false, label: "no-tool" },
  ];

  for (const attempt of attempts) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      console.log(`[Gemini AI] (${attempt.label}) Starting search for: ${name}`);

      // v1beta expects camelCase tool key: `googleSearch`
      const body: Record<string, unknown> = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 100,
        },
      };
      if (attempt.withSearch) {
        body.tools = [{ googleSearch: {} }];
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json() as GeminiResponsePayload;
        const textPart = data.candidates?.[0]?.content?.parts?.find(p => typeof p.text === "string")?.text;
        const text = typeof textPart === "string" ? textPart.trim() : undefined;

        console.log(`[Gemini AI] (${attempt.label}) Output for ${name}: ${text}`);

        if (text && text !== "NOT_FOUND" && text.includes("@")) {
          const extracted = bestEmailFromText(text, website);
          if (extracted) return extracted;
        }
        return undefined; // reached model but no email — don't retry without tool
      }

      const errText = await response.text();
      console.error(`[Gemini AI] (${attempt.label}) HTTP ${response.status}: ${errText.slice(0, 300)}`);

      // 400/403 with tool → likely grounding not entitled. Retry without.
      if (attempt.withSearch && (response.status === 400 || response.status === 403)) {
        console.warn("[Gemini AI] Grounding tool rejected — retrying without googleSearch tool");
        continue;
      }

      // Genuine key/quota/model problems → surface to caller.
      if (response.status === 401 || response.status === 403 || response.status === 429 || response.status === 404) {
        throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 200)}`);
      }
      // Other errors — just return undefined (best-effort)
      return undefined;
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err.name === "AbortError") {
        console.warn(`[Gemini AI] (${attempt.label}) Timed out for ${name}`);
        continue; // try next attempt
      }
      console.error(`[Gemini AI] (${attempt.label}) Error:`, err);
      // Only re-throw if we exhausted both attempts and it's a real API-key/billing issue
      if (attempt === attempts[attempts.length - 1] && err.message && (err.message.includes("Gemini API error 401") || err.message.includes("Gemini API error 429"))) {
        throw new Error(err.message);
      }
    }
  }

  return undefined;
}

// ─── OpenAI GPT Email Finder ──────────────────────────────────────────────────

export async function askOpenAIForEmail(apiKey: string, name: string, website: string, phone: string, address?: string): Promise<string | undefined> {
  const addressText = address ? ` at ${address}` : "";
  const prompt = `Find the verified public contact email for the business: "${name}"${addressText}.
Website: ${website || "none"}
Phone: ${phone || "none"}

Search the web (their official site, Google Business, LinkedIn, Facebook, contact pages) and return ONLY the email address, or exactly NOT_FOUND if you can't verify one.`;

  // Two-tier strategy:
  //   1) `gpt-4o-mini-search-preview` — has native web browsing (best signal)
  //   2) `gpt-4o-mini`                — no browsing, best-effort from training data
  //
  // Many OpenAI accounts don't have `search-preview` entitlement yet — that
  // triggers 401 or 404 on the FIRST attempt. We MUST still try the plain
  // model before declaring the key invalid.
  const attempts = [
    { model: "gpt-4o-mini-search-preview", supportsTemperature: false, retryOnAccessError: true },
    { model: "gpt-4o-mini",                supportsTemperature: true,  retryOnAccessError: false },
  ];

  let lastFatalError: string | null = null;

  for (const attempt of attempts) {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 20000);

      console.log(`[OpenAI AI] (${attempt.model}) Starting search for: ${name}`);

      const body: Record<string, unknown> = {
        model: attempt.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
      };
      if (attempt.supportsTemperature) body.temperature = 0;

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      timeoutId = undefined;

      if (response.ok) {
        const data = await response.json() as {
          choices?: Array<{ message?: { content?: string | null } }>;
        };
        const text = data.choices?.[0]?.message?.content?.trim();
        console.log(`[OpenAI AI] (${attempt.model}) Output for ${name}: ${text}`);
        if (text && text !== "NOT_FOUND" && text.includes("@")) {
          const extracted = bestEmailFromText(text, website);
          if (extracted) return extracted;
        }
        return undefined; // reached the model, no email — no point retrying
      }

      const errText = await response.text();
      console.error(`[OpenAI AI] (${attempt.model}) HTTP ${response.status}: ${errText.slice(0, 300)}`);

      // Detect model-access-denied vs true invalid-key.
      // OpenAI's 401/403 bodies specifically mention "model" or "access" when
      // the KEY is fine but the account can't use that model.
      const lower = errText.toLowerCase();
      const isModelAccessError =
        response.status === 404 ||
        response.status === 400 ||
        (response.status === 403 && (lower.includes("model") || lower.includes("does not have access") || lower.includes("must be verified"))) ||
        (response.status === 401 && (lower.includes("model") || lower.includes("does not have access") || lower.includes("must be verified")));

      if (isModelAccessError && attempt.retryOnAccessError) {
        console.warn(`[OpenAI AI] ${attempt.model} unavailable for this account — falling back to plain gpt-4o-mini`);
        continue; // try the next (plain) model
      }

      // 401 / 429 on the FINAL (plain) attempt → real key/quota problem
      if (response.status === 401 || response.status === 429) {
        lastFatalError = `OpenAI API error ${response.status}: ${errText.slice(0, 200)}`;
        // Do NOT throw yet if there's a next attempt to try
        if (attempt !== attempts[attempts.length - 1]) continue;
        throw new Error(lastFatalError);
      }

      // Other 4xx/5xx → return undefined (best-effort)
      return undefined;
    } catch (e: unknown) {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      const err = e as { name?: string; message?: string };
      if (err.name === "AbortError") {
        console.warn(`[OpenAI AI] (${attempt.model}) Timed out for ${name}`);
        continue;
      }
      // Only propagate hard credential/quota errors AFTER exhausting all attempts
      const isLast = attempt === attempts[attempts.length - 1];
      if (isLast && err.message && (err.message.includes("OpenAI API error 401") || err.message.includes("OpenAI API error 429"))) {
        throw new Error(err.message);
      }
      console.error(`[OpenAI AI] (${attempt.model}) Error:`, err);
    }
  }

  return undefined;
}

// ─── Google Places API Provider ───────────────────────────────────────────────

type GooglePlace = {
  place_id: string;
  name?: string;
  types?: string[];
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  email?: string;
  rating?: number;
  user_ratings_total?: number;
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
};

type GooglePlacesTextSearchResponse = {
  status: string;
  error_message?: string;
  results?: GooglePlace[];
  next_page_token?: string;
};

type GooglePlaceDetailsResponse = {
  status: string;
  result?: GooglePlace;
};

const GOOGLE_PLACES_PAGE_SIZE = 20;
const GOOGLE_PLACES_MAX_RESULTS_PER_QUERY = 60;
const GOOGLE_PLACES_CITY_SWEEP_LIMIT = 500;
const DEBUG_GOOGLE_PLACES = process.env.DEBUG_GOOGLE_PLACES === "1";

function logGooglePlaces(message: string) {
  if (DEBUG_GOOGLE_PLACES) console.log(message);
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export class GooglePlacesProvider implements LeadProvider {
  name = "google-places";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchBusinesses(params: BusinessSearchParams): Promise<SearchResult> {
    const locationParts = [];
    if (params.city) locationParts.push(params.city);
    if (params.state) locationParts.push(params.state);
    if (params.country) locationParts.push(params.country);

    const locationString = locationParts.join(", ");
    
    let queryText = params.niche || "businesses";
    if (locationString) {
      queryText += ` in ${locationString}`;
    }

    const maxResultsRequested = params.maxResults || GOOGLE_PLACES_PAGE_SIZE;
    const maxToFetch = Math.min(maxResultsRequested, GOOGLE_PLACES_CITY_SWEEP_LIMIT);

    // We fetch extra to account for filtering (leads without website/phone)
    const multiplier = (params.hasWebsite || params.hasPhone) ? 2.5 : 1.5;
    const fetchTarget = Math.min(Math.ceil(maxToFetch * multiplier), GOOGLE_PLACES_CITY_SWEEP_LIMIT);

    logGooglePlaces(`[GooglePlaces] Searching for: "${queryText}". Requested: ${maxResultsRequested}, FetchTarget: ${fetchTarget}`);

    let allResults: GooglePlace[] = [];
    let nextToken: string | undefined;

    if (params.pageToken) {
      logGooglePlaces(`[GooglePlaces] Fetching next page with token`);
      const pageUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${encodeURIComponent(params.pageToken)}&key=${this.apiKey}`;
      const pageData = await this.fetchTextSearch(pageUrl, true);
      this.assertTextSearchOk(pageData);
      const collected = await this.collectPagesFromData(pageData, fetchTarget);
      allResults = collected.places;
      nextToken = collected.nextPageToken;
    } else if (fetchTarget > 20) {
      logGooglePlaces(`[GooglePlaces] Starting City Sweep for ${fetchTarget} results to avoid slow pagination tokens`);
      allResults = await this.collectCitySweepResults(queryText, locationString, params.niche, fetchTarget);
      // For city sweep, we don't easily have a single next_page_token since it's multiple queries
      nextToken = undefined; 
    } else {
      logGooglePlaces(`[GooglePlaces] Single query search`);
      const searchData = await this.fetchQueryTextSearch(queryText);
      this.assertTextSearchOk(searchData);
      const collected = await this.collectPagesFromData(searchData, fetchTarget);
      allResults = collected.places;
      nextToken = collected.nextPageToken;
    }

    logGooglePlaces(`[GooglePlaces] Raw results found: ${allResults.length}. Deduping and fetching details...`);

    const uniquePlaces = this.dedupePlaces(allResults);
    logGooglePlaces(`[GooglePlaces] Unique places: ${uniquePlaces.length}`);

    const businesses: BusinessLead[] = (await mapWithConcurrency(
      uniquePlaces,
      50, // Massive concurrency to ensure it finishes <10s for Server Actions
      async (place) => {
        try {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,geometry,url&key=${this.apiKey}`;
          const detailsRes = await fetch(detailsUrl);
          const detailsData = await detailsRes.json() as GooglePlaceDetailsResponse;
          
          const details: GooglePlace = detailsData.result ?? { place_id: place.place_id };
          
          return {
            sourceId: place.place_id,
            businessName: place.name || details.name,
            category: params.niche || place.types?.[0],
            address: details.formatted_address || place.formatted_address,
            city: params.city,
            state: params.state,
            country: params.country,
            latitude: place.geometry?.location?.lat,
            longitude: place.geometry?.location?.lng,
            phone: details.formatted_phone_number,
            website: details.website,
            email: details.email,
            emailSources: details.email ? ["Google Map"] : [],
            rating: details.rating || place.rating,
            reviewCount: details.user_ratings_total || place.user_ratings_total,
            rawData: { ...place, ...details },
          } as BusinessLead;
        } catch (err) {
          console.error(`[GooglePlaces] Error fetching details for ${place.place_id}:`, err);
          return null;
        }
      }
    )).filter((biz): biz is BusinessLead => {
      if (!biz) return false;
      if (params.minRating && biz.rating && biz.rating < params.minRating) return false;
      if (params.minReviewCount && biz.reviewCount && biz.reviewCount < params.minReviewCount) return false;
      if (params.hasPhone && !biz.phone) return false;
      if (params.hasWebsite && !biz.website) return false;
      return true;
    });

    const finalLeads = this.dedupeBusinessLeads(businesses).slice(0, maxToFetch);
    logGooglePlaces(`[GooglePlaces] Final leads after filtering and deduping: ${finalLeads.length}`);

    return {
      businesses: finalLeads,
      totalFound: finalLeads.length,
      usageConsumed: finalLeads.length,
      nextPageToken: nextToken,
    };
  }

  private assertTextSearchOk(data: GooglePlacesTextSearchResponse) {
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(`Google Places API error: ${data.status} - ${data.error_message || ""}`);
    }
  }

  private async fetchQueryTextSearch(query: string): Promise<GooglePlacesTextSearchResponse> {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${this.apiKey}`;
    return this.fetchTextSearch(url, false);
  }

  private async collectPagesFromData(
    firstData: GooglePlacesTextSearchResponse,
    maxResults: number
  ): Promise<{ places: GooglePlace[]; nextPageToken?: string }> {
    let allResults = firstData.results || [];
    let nextToken = firstData.next_page_token;

    logGooglePlaces(`[GooglePlaces] Page 1: Found ${allResults.length} leads. Next token: ${!!nextToken}`);

    let page = 2;
    while (allResults.length < maxResults && nextToken) {
      // Small delay because Google requires a moment for the token to become active
      await wait(2000); 

      const nextUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${encodeURIComponent(nextToken)}&key=${this.apiKey}`;
      const nextData = await this.fetchTextSearch(nextUrl, true);
      
      if (nextData.status !== "OK" && nextData.status !== "ZERO_RESULTS") {
        logGooglePlaces(`[GooglePlaces] Page ${page} failed with status: ${nextData.status}`);
        break;
      }

      const newResults = nextData.results || [];
      allResults = [...allResults, ...newResults];
      nextToken = nextData.next_page_token;
      
      logGooglePlaces(`[GooglePlaces] Page ${page}: Found ${newResults.length} more. Total: ${allResults.length}. Next token: ${!!nextToken}`);
      page++;

      if (newResults.length === 0) break;
    }

    return { places: allResults, nextPageToken: nextToken };
  }

  private async collectCitySweepResults(
    baseQuery: string,
    locationString: string,
    niche: string | undefined,
    maxResults: number
  ): Promise<GooglePlace[]> {
    const collected = new Map<string, GooglePlace>();
    const allQueries = this.buildCitySweepQueries(baseQuery, locationString, niche);
    
    // Limit the number of queries to avoid 10s Server Action timeout
    // Each query returns up to 20 results. 
    const maxQueriesNeeded = Math.max(3, Math.ceil(maxResults / 20) * 2);
    const queries = allQueries.slice(0, maxQueriesNeeded);
    
    logGooglePlaces(`[GooglePlaces] Sweep: Trying ${queries.length} unique queries to find ${maxResults} results`);

    // Run up to 3 queries concurrently to avoid hitting 10s Server Action timeout
    await mapWithConcurrency(queries, 3, async (query) => {
      if (collected.size >= maxResults) return;

      logGooglePlaces(`[GooglePlaces] Sweep Query: "${query}" (Current total: ${collected.size})`);
      const data = await this.fetchQueryTextSearch(query);
      
      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        if (data.status === "REQUEST_DENIED" || data.status === "OVER_QUERY_LIMIT") {
          throw new Error(`Google Places API error: ${data.status} - ${data.error_message || ""}`);
        }
        return;
      }

      // During sweep we ONLY take the first page (up to 20 leads) to avoid the 2s nextPageToken delay.
      const places = data.results || [];

      for (const place of places) {
        if (collected.size < maxResults && !collected.has(place.place_id)) {
          collected.set(place.place_id, place);
        }
      }
      
      logGooglePlaces(`[GooglePlaces] Sweep Query finished. Collected so far: ${collected.size}`);
    });

    return Array.from(collected.values()).slice(0, maxResults);
  }

  private buildCitySweepQueries(baseQuery: string, locationString: string, niche?: string): string[] {
    if (!locationString) return [baseQuery];

    const term = niche || "businesses";
    const cityOnly = locationString.split(",")[0]?.trim();
    const queries = [
      baseQuery,
      `${term} near ${locationString}`,
      `${cityOnly} ${term}`,
      `best ${term} in ${locationString}`,
      `top rated ${term} in ${locationString}`,
      `local ${term} in ${locationString}`,
      `${term} services in ${locationString}`,
      `${term} companies in ${locationString}`,
      `${term} north ${cityOnly}`,
      `${term} south ${cityOnly}`,
      `${term} east ${cityOnly}`,
      `${term} west ${cityOnly}`,
      `${term} downtown ${cityOnly}`,
      `${term} central ${cityOnly}`,
    ];

    return Array.from(new Set(queries.filter(Boolean)));
  }

  private dedupePlaces(places: GooglePlace[]): GooglePlace[] {
    return Array.from(new Map(places.map((place) => [place.place_id, place])).values());
  }

  private dedupeBusinessLeads(leads: BusinessLead[]): BusinessLead[] {
    const seen = new Set<string>();
    const unique: BusinessLead[] = [];

    for (const lead of leads) {
      const domain = getWebsiteHost(lead.website);
      const phone = lead.phone?.replace(/\D/g, "");
      const nameAddress = `${lead.businessName}|${lead.address || ""}`.toLowerCase().replace(/\s+/g, " ").trim();
      const keys = [
        `id:${lead.sourceId}`,
        phone ? `phone:${phone}` : "",
        domain ? `domain:${domain}` : "",
        nameAddress ? `name_address:${nameAddress}` : "",
      ].filter(Boolean);

      if (keys.some((key) => seen.has(key))) continue;

      keys.forEach((key) => seen.add(key));
      unique.push(lead);
    }

    return unique;
  }

  private async fetchTextSearch(url: string, isPageTokenRequest: boolean): Promise<GooglePlacesTextSearchResponse> {
    const attempts = isPageTokenRequest ? 4 : 1;

    for (let attempt = 0; attempt < attempts; attempt++) {
      if (isPageTokenRequest && attempt > 0) {
        await wait(2000);
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Google Places API error: ${res.statusText}`);
      }

      const data = await res.json() as GooglePlacesTextSearchResponse;
      if (data.status !== "INVALID_REQUEST" || !isPageTokenRequest || attempt === attempts - 1) {
        return data;
      }
    }

    return { status: "INVALID_REQUEST" };
  }

  async getBusinessDetails(sourceId: string): Promise<BusinessLead | null> {
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${sourceId}&key=${this.apiKey}`;
    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json();
    
    if (detailsData.status !== "OK") return null;
    const place = detailsData.result;
    
    return {
      sourceId: place.place_id,
      businessName: place.name,
      address: place.formatted_address,
      latitude: place.geometry?.location?.lat,
      longitude: place.geometry?.location?.lng,
      phone: place.formatted_phone_number,
      website: place.website,
      rating: place.rating,
      reviewCount: place.user_ratings_total,
      rawData: place,
    };
  }

  async getUsage(): Promise<UsageInfo> {
    return { used: 0, limit: 10000, remaining: 10000 };
  }
}

// ─── Provider Factory ─────────────────────────────────────────────────────────

export async function getLeadProvider(organizationId: string): Promise<LeadProvider> {
  const integrations = await prisma.integration.findMany({
    where: { organizationId, isActive: true },
  });

  const googleIntegration = integrations.find(i => i.provider === "google-places");
  const getApiKey = (credentials: unknown): string | undefined => {
    if (!credentials || typeof credentials !== "object" || !("apiKey" in credentials)) return undefined;
    const apiKey = (credentials as { apiKey?: unknown }).apiKey;
    if (typeof apiKey !== "string" || !apiKey.trim()) return undefined;
    try {
      const decrypted = decryptToken(apiKey);
      return decrypted && decrypted.trim() ? decrypted : undefined;
    } catch {
      return apiKey;
    }
  };

  const googleApiKey = getApiKey(googleIntegration?.credentials);
  if (googleApiKey) {
    return new GooglePlacesProvider(googleApiKey);
  }

  return new MockLeadProvider();
}
