import { supabase } from "@/lib/supabase";
import { decryptToken } from "./crypto";
import { findIntegrationApiKey } from "./integrations";

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
    } else if (fetchTarget > GOOGLE_PLACES_MAX_RESULTS_PER_QUERY) {
      logGooglePlaces(`[GooglePlaces] Starting City Sweep for ${fetchTarget} results`);
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
      10, // Increased concurrency for speed
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
    const queries = this.buildCitySweepQueries(baseQuery, locationString, niche);
    
    logGooglePlaces(`[GooglePlaces] Sweep: Trying ${queries.length} unique queries to find ${maxResults} results`);

    for (const query of queries) {
      if (collected.size >= maxResults) break;

      logGooglePlaces(`[GooglePlaces] Sweep Query: "${query}" (Current total: ${collected.size})`);
      const data = await this.fetchQueryTextSearch(query);
      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") continue;

      // Each query can provide up to 60 leads (3 pages). 
      // We ask for up to 60 per query to ensure we actually fill the map.
      const pageBatch = await this.collectPagesFromData(
        data,
        60 
      );

      for (const place of pageBatch.places) {
        if (!collected.has(place.place_id)) {
          collected.set(place.place_id, place);
        }
      }
      
      logGooglePlaces(`[GooglePlaces] Sweep Query finished. Collected so far: ${collected.size}`);
    }

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

  private getWebsiteHost(website?: string): string | undefined {
    if (!website) return undefined;
    try {
      return new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "");
    } catch {
      return undefined;
    }
  }

  private dedupeBusinessLeads(leads: BusinessLead[]): BusinessLead[] {
    const seen = new Set<string>();
    const unique: BusinessLead[] = [];

    for (const lead of leads) {
      const domain = this.getWebsiteHost(lead.website);
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
  const { data: integrations } = await supabase
    .from("integrations")
    .select("*")
    .eq("organizationId", organizationId)
    .eq("isActive", true);

  const googleApiKey = findIntegrationApiKey(integrations || [], "google-places", [
    "GOOGLE_PLACES_API_KEY",
    "GOOGLE_MAPS_API_KEY",
  ]);
  if (googleApiKey) {
    return new GooglePlacesProvider(googleApiKey);
  }

  return new MockLeadProvider();
}
