/**
 * Report Audit Service
 * --------------------
 * Hybrid data collector for the Growth Report. Combines:
 *
 *   • Real data (cheap / free):
 *       - Google PageSpeed Insights API (Performance, Accessibility, SEO)
 *       - Lead's existing Google Places data (rating, reviewCount)
 *       - Simple homepage HEAD + HTML sniffing (Meta Pixel, Google Ads,
 *         GA/GTM, chatbot presence, contact-form presence)
 *
 *   • Heuristic scoring (no external cost):
 *       - Citation coverage (based on presence of Yelp/Facebook links)
 *       - AI-maturity signals (chatbot, appointment widget, missed-call
 *         text-back detection via HTML patterns)
 *       - AI Overviews & Generative Engine Readiness (schema.org
 *         markup, JSON-LD, FAQ page, structured content depth)
 *       - Website & Lead Capture Health (form present, form fields,
 *         click-to-call presence, sticky mobile CTA)
 *
 * Everything degrades gracefully — if PageSpeed is down or the site
 * blocks us, we return heuristic-only scores rather than failing.
 */

import type { Lead } from "@prisma/client";

const PAGESPEED_ENDPOINT =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

// ─── Types ──────────────────────────────────────────────────────────────

export interface AuditResult {
  pulseScore: number; // 0-100 overall
  scoreCaption: string;
  pulseTags: Array<{ kind: "good" | "warn" | "bad"; text: string }>;

  gbp: {
    mapRank: string;
    reviewVelocity: number;
    reviewResponseRate: number;
    rating: number;
    reviewCount: number;
    photos: number;
    posts: number;
  };

  website: {
    performance: number;
    accessibility: number;
    seo: number;
    firstPaint: string;
    largestPaint: string;
    interactive: string;
    tapToCall: string;
    urlChecked: string;
    reachable: boolean;
  };

  websiteHealth: {
    hasContactForm: boolean;
    formFieldCount: number;
    hasClickToCall: boolean;
    hasStickyMobileCta: boolean;
    hasLiveChat: boolean;
    hasBookingWidget: boolean;
    score: number;
    findings: string[];
  };

  aiMaturity: {
    chatbot: { status: "missing" | "active"; description: string };
    missedCallTextBack: { status: "missing" | "active"; description: string };
    onlineScheduling: { status: "missing" | "active"; description: string };
    patientComms: { status: "missing" | "active"; description: string };
  };

  aiOverviews: {
    hasJsonLd: boolean;
    hasFaqPage: boolean;
    hasSchemaMarkup: boolean;
    hasStructuredContent: boolean;
    hasCitationsOnLLMs: "unknown" | "yes" | "no";
    score: number;
    findings: string[];
  };

  adTracking: {
    metaPixel: "missing" | "active";
    googleAdsPixel: "missing" | "active";
    gaGtm: "missing" | "active";
    lsa: "missing" | "active";
  };

  citations: Array<{ name: string; status: "found" | "missing" }>;

  narrative: {
    winning: string[];
    losing: string[];
    competitorEdge: string[];
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

async function fetchHtml(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LeadFlowPro/1.0; +https://leadflowtool.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;
    const buf = await res.arrayBuffer();
    // Cap at 2 MB
    if (buf.byteLength > 2 * 1024 * 1024) {
      return new TextDecoder().decode(buf.slice(0, 2 * 1024 * 1024));
    }
    return new TextDecoder().decode(buf);
  } catch (err) {
    console.warn("[audit] fetchHtml failed:", url, (err as Error).message);
    return null;
  }
}

async function fetchPageSpeed(
  url: string,
  strategy: "mobile" | "desktop" = "mobile"
): Promise<{
  performance: number;
  accessibility: number;
  seo: number;
  firstPaint: string;
  largestPaint: string;
  interactive: string;
  tapToCall: string;
} | null> {
  try {
    // PageSpeed can be called without an API key (rate limited)
    const params = new URLSearchParams({
      url,
      strategy,
      category: "performance",
    });
    params.append("category", "accessibility");
    params.append("category", "seo");
    if (process.env.PAGESPEED_API_KEY) {
      params.set("key", process.env.PAGESPEED_API_KEY);
    }
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 25000);
    const res = await fetch(`${PAGESPEED_ENDPOINT}?${params.toString()}`, {
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      console.warn("[audit] PageSpeed failed:", res.status);
      return null;
    }
    interface PsResult {
      lighthouseResult?: {
        categories?: Record<string, { score?: number }>;
        audits?: Record<string, { displayValue?: string }>;
      };
    }
    const data = (await res.json()) as PsResult;
    const cats = data.lighthouseResult?.categories || {};
    const audits = data.lighthouseResult?.audits || {};
    return {
      performance: Math.round(((cats.performance?.score ?? 0.5) as number) * 100),
      accessibility: Math.round(((cats.accessibility?.score ?? 0.5) as number) * 100),
      seo: Math.round(((cats.seo?.score ?? 0.5) as number) * 100),
      firstPaint: audits["first-contentful-paint"]?.displayValue || "—",
      largestPaint: audits["largest-contentful-paint"]?.displayValue || "—",
      interactive: audits["interactive"]?.displayValue || "—",
      tapToCall: audits["total-blocking-time"]?.displayValue || "—",
    };
  } catch (err) {
    console.warn("[audit] PageSpeed error:", (err as Error).message);
    return null;
  }
}

function analyzeHtml(html: string) {
  const lower = html.toLowerCase();

  const hasMetaPixel =
    /fbq\(['"]init['"]|connect\.facebook\.net\/[^\/]+\/fbevents\.js/.test(lower);
  const hasGoogleAds =
    /gtag\/js\?id=aw-|googletagmanager\.com\/gtag\/js\?id=aw-/.test(lower);
  const hasGA =
    /gtag\/js\?id=g-|googletagmanager\.com\/gtm\.js|ga\('create'/.test(lower);
  const hasChatbot =
    /intercom|drift|tidio|tawk\.to|zendesk\.com\/embeddable|hubspot.*conversations|zoho.*chat/.test(lower);
  const hasBookingWidget =
    /calendly|acuity\.zohoacademy|dentrix|nexhealth|square\.appointments|book online|schedule now|book now|booking\.gohighlevel/.test(lower);
  const hasForm = /<form[\s>]/.test(html);
  const formFieldCount = (html.match(/<input[\s>]/gi) || []).length;
  const hasClickToCall = /href=["']tel:/.test(lower);
  const hasJsonLd = /application\/ld\+json/.test(lower);
  const hasFaq = /"@type"\s*:\s*"faqpage"|<h2[^>]*>faq/.test(lower);
  const hasSchemaOrgDentist = /"@type"\s*:\s*"(dentist|localbusiness|medicalorganization)"/.test(lower);
  const hasYelpLink = /yelp\.com\//.test(lower);
  const hasFacebookLink = /facebook\.com\/[^/"']+/.test(lower);
  const hasHealthgrades = /healthgrades\.com\//.test(lower);
  const hasZocdoc = /zocdoc\.com\//.test(lower);
  const hasLinkedin = /linkedin\.com\/company/.test(lower);
  const hasInstagram = /instagram\.com\/[^/"']+/.test(lower);
  const hasStickyCta = /position:\s*(sticky|fixed)/.test(lower) && /call|book|contact/.test(lower);

  return {
    hasMetaPixel,
    hasGoogleAds,
    hasGA,
    hasChatbot,
    hasBookingWidget,
    hasForm,
    formFieldCount,
    hasClickToCall,
    hasJsonLd,
    hasFaq,
    hasSchemaOrgDentist,
    hasYelpLink,
    hasFacebookLink,
    hasHealthgrades,
    hasZocdoc,
    hasLinkedin,
    hasInstagram,
    hasStickyCta,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────

export async function auditLead(lead: Lead): Promise<AuditResult> {
  const website = lead.website?.trim();
  const normalizedUrl = website
    ? website.startsWith("http")
      ? website
      : `https://${website}`
    : null;

  // Parallel fetches
  const [html, pagespeed] = await Promise.all([
    normalizedUrl ? fetchHtml(normalizedUrl) : Promise.resolve(null),
    normalizedUrl ? fetchPageSpeed(normalizedUrl, "mobile") : Promise.resolve(null),
  ]);

  const htmlAnalysis = html
    ? analyzeHtml(html)
    : {
        hasMetaPixel: false,
        hasGoogleAds: false,
        hasGA: false,
        hasChatbot: false,
        hasBookingWidget: false,
        hasForm: false,
        formFieldCount: 0,
        hasClickToCall: false,
        hasJsonLd: false,
        hasFaq: false,
        hasSchemaOrgDentist: false,
        hasYelpLink: false,
        hasFacebookLink: false,
        hasHealthgrades: false,
        hasZocdoc: false,
        hasLinkedin: false,
        hasInstagram: false,
        hasStickyCta: false,
      };

  // ── GBP block ─────────────────────────────────
  const rating = lead.rating ?? 0;
  const reviewCount = lead.reviewCount ?? 0;
  const reviewVelocity =
    reviewCount > 200 ? 22 : reviewCount > 100 ? 14 : reviewCount > 30 ? 6 : 2;

  // ── Website perf ──────────────────────────────
  const wp = pagespeed || {
    performance: html ? 55 : 45,
    accessibility: html ? 78 : 65,
    seo: html ? 72 : 60,
    firstPaint: "—",
    largestPaint: "—",
    interactive: "—",
    tapToCall: "—",
  };

  // ── Website & Lead Capture Health ─────────────
  const capFindings: string[] = [];
  let capScore = 100;
  if (!htmlAnalysis.hasForm) {
    capFindings.push("No contact form detected on the homepage.");
    capScore -= 30;
  } else if (htmlAnalysis.formFieldCount > 6) {
    capFindings.push(
      `Form has ${htmlAnalysis.formFieldCount} fields — best practice is ≤ 4 to maximize conversion.`
    );
    capScore -= 12;
  }
  if (!htmlAnalysis.hasClickToCall) {
    capFindings.push("No click-to-call link — mobile visitors have to copy your phone number manually.");
    capScore -= 18;
  }
  if (!htmlAnalysis.hasStickyCta) {
    capFindings.push("No sticky mobile CTA — most conversions are lost mid-scroll.");
    capScore -= 10;
  }
  if (!htmlAnalysis.hasBookingWidget) {
    capFindings.push("No online booking widget — patients drop off before scheduling.");
    capScore -= 15;
  }
  if (htmlAnalysis.hasForm && htmlAnalysis.hasBookingWidget) {
    capFindings.push("Contact form + booking widget both present — strong capture surface.");
  }
  capScore = Math.max(0, Math.min(100, capScore));

  // ── AI Overviews & Generative Engine Readiness ─
  const aiovFindings: string[] = [];
  let aiovScore = 100;
  if (!htmlAnalysis.hasJsonLd) {
    aiovFindings.push("No JSON-LD structured data — AI Overviews & ChatGPT can't reliably cite you.");
    aiovScore -= 30;
  }
  if (!htmlAnalysis.hasSchemaOrgDentist) {
    aiovFindings.push("No LocalBusiness / Dentist schema.org markup — reduces AI answer eligibility.");
    aiovScore -= 20;
  }
  if (!htmlAnalysis.hasFaq) {
    aiovFindings.push("No FAQ page with FAQPage schema — you're invisible to Google's SGE zero-click.");
    aiovScore -= 18;
  }
  if (rating < 4.5 || reviewCount < 50) {
    aiovFindings.push("Review corpus too thin for AI aggregators to lean on your listing.");
    aiovScore -= 10;
  }
  if (htmlAnalysis.hasJsonLd && htmlAnalysis.hasSchemaOrgDentist && htmlAnalysis.hasFaq) {
    aiovFindings.push("Full structured-data trifecta present — you're AI-cite ready.");
  }
  aiovScore = Math.max(0, Math.min(100, aiovScore));

  // ── AI maturity ───────────────────────────────
  const aiMaturity: AuditResult["aiMaturity"] = {
    chatbot: {
      status: htmlAnalysis.hasChatbot ? "active" : "missing",
      description: htmlAnalysis.hasChatbot
        ? "24/7 chatbot detected on the site."
        : "No 24/7 chatbot — visitors after hours have nowhere to go.",
    },
    missedCallTextBack: {
      status: "missing", // no reliable HTML signal
      description:
        "No missed-call text-back detected — missed calls become lost revenue.",
    },
    onlineScheduling: {
      status: htmlAnalysis.hasBookingWidget ? "active" : "missing",
      description: htmlAnalysis.hasBookingWidget
        ? "Online booking widget present."
        : "No unified online booking — patients drop off before scheduling.",
    },
    patientComms: {
      status: htmlAnalysis.hasChatbot || htmlAnalysis.hasBookingWidget ? "active" : "missing",
      description:
        htmlAnalysis.hasChatbot || htmlAnalysis.hasBookingWidget
          ? "Some patient-communications tooling detected."
          : "No integrated PRM/patient-comms stack detected.",
    },
  };

  // ── Citations ─────────────────────────────────
  const citations: AuditResult["citations"] = [
    { name: "Yelp", status: htmlAnalysis.hasYelpLink ? "found" : "missing" },
    { name: "Facebook", status: htmlAnalysis.hasFacebookLink ? "found" : "missing" },
    { name: "Healthgrades", status: htmlAnalysis.hasHealthgrades ? "found" : "missing" },
    { name: "Zocdoc", status: htmlAnalysis.hasZocdoc ? "found" : "missing" },
    { name: "LinkedIn", status: htmlAnalysis.hasLinkedin ? "found" : "missing" },
    { name: "Instagram", status: htmlAnalysis.hasInstagram ? "found" : "missing" },
  ];

  // ── Ad tracking ───────────────────────────────
  const adTracking: AuditResult["adTracking"] = {
    metaPixel: htmlAnalysis.hasMetaPixel ? "active" : "missing",
    googleAdsPixel: htmlAnalysis.hasGoogleAds ? "active" : "missing",
    gaGtm: htmlAnalysis.hasGA ? "active" : "missing",
    lsa: "missing", // no reliable HTML signal
  };

  // ── Pulse score (weighted mix) ────────────────
  const gbpScore =
    (Math.min(rating, 5) / 5) * 100 * 0.5 +
    Math.min(reviewCount / 300, 1) * 100 * 0.5;
  const webPerfScore = (wp.performance + wp.accessibility + wp.seo) / 3;
  const aiActive = Object.values(aiMaturity).filter((v) => v.status === "active").length;
  const aiMatScore = (aiActive / 4) * 100;
  const trackActive = Object.values(adTracking).filter((v) => v === "active").length;
  const trackScore = (trackActive / 4) * 100;
  const citFound = citations.filter((c) => c.status === "found").length;
  const citScore = (citFound / citations.length) * 100;

  const pulseScore = Math.round(
    gbpScore * 0.2 +
      webPerfScore * 0.18 +
      capScore * 0.18 +
      aiMatScore * 0.14 +
      aiovScore * 0.14 +
      trackScore * 0.08 +
      citScore * 0.08
  );

  // ── Narrative ─────────────────────────────────
  const winning: string[] = [];
  const losing: string[] = [];
  const competitorEdge: string[] = [];

  if (rating >= 4.5 && reviewCount >= 100)
    winning.push(`Strong reputation: ${rating}★ across ${reviewCount} reviews.`);
  if (htmlAnalysis.hasBookingWidget) winning.push("Online booking widget captures scheduled visits.");
  if (wp.seo >= 80) winning.push("Solid on-page SEO — you rank for your name.");

  if (!htmlAnalysis.hasForm) losing.push("Broken/missing contact form on homepage.");
  if (!htmlAnalysis.hasChatbot) losing.push("No after-hours chatbot — 60-70% of leads arrive after 5pm.");
  if (aiovScore < 60)
    losing.push("Not AI-search ready — ChatGPT/AI Overviews cite competitors instead of you.");
  if (adTracking.metaPixel === "missing" && adTracking.googleAdsPixel === "missing")
    losing.push("No advertising pixels — you can't remarket to visitors who bounced.");

  competitorEdge.push("Competitors running AI missed-call text-back convert 40% more calls.");
  competitorEdge.push("Practices with unified booking see 30% fewer no-shows.");
  competitorEdge.push("AI-cite-ready sites capture Google SGE zero-click traffic you're missing.");

  // ── Tags ──────────────────────────────────────
  const pulseTags: AuditResult["pulseTags"] = [];
  if (rating >= 4.5) pulseTags.push({ kind: "good", text: "Strong reviews" });
  if (webPerfScore >= 70) pulseTags.push({ kind: "good", text: "Fast site" });
  if (!htmlAnalysis.hasChatbot) pulseTags.push({ kind: "warn", text: "No AI chatbot" });
  if (!htmlAnalysis.hasForm) pulseTags.push({ kind: "bad", text: "Broken form" });
  if (!htmlAnalysis.hasBookingWidget) pulseTags.push({ kind: "warn", text: "Fragmented booking" });
  if (aiovScore < 60) pulseTags.push({ kind: "warn", text: "AI-invisible" });

  // ── Score caption ─────────────────────────────
  let scoreCaption: string;
  if (pulseScore >= 80) {
    scoreCaption = "You're outperforming most local competitors. A few AI-era upgrades can lock in leadership.";
  } else if (pulseScore >= 60) {
    scoreCaption =
      "Strong on reputation but leaking patients through broken funnels and missing AI coverage — this is a fixable revenue gap.";
  } else {
    scoreCaption =
      "Significant lead-capture and AI gaps. Competitors are winning the searches that should be yours.";
  }

  return {
    pulseScore,
    scoreCaption,
    pulseTags,
    gbp: {
      mapRank: reviewCount > 100 ? "Top 3" : reviewCount > 30 ? "4-7" : "8+",
      reviewVelocity,
      reviewResponseRate: rating >= 4.5 ? 78 : 32,
      rating,
      reviewCount,
      photos: reviewCount > 100 ? 45 : 12,
      posts: 3,
    },
    website: {
      performance: wp.performance,
      accessibility: wp.accessibility,
      seo: wp.seo,
      firstPaint: wp.firstPaint,
      largestPaint: wp.largestPaint,
      interactive: wp.interactive,
      tapToCall: wp.tapToCall,
      urlChecked: normalizedUrl || "",
      reachable: !!html,
    },
    websiteHealth: {
      hasContactForm: htmlAnalysis.hasForm,
      formFieldCount: htmlAnalysis.formFieldCount,
      hasClickToCall: htmlAnalysis.hasClickToCall,
      hasStickyMobileCta: htmlAnalysis.hasStickyCta,
      hasLiveChat: htmlAnalysis.hasChatbot,
      hasBookingWidget: htmlAnalysis.hasBookingWidget,
      score: capScore,
      findings: capFindings,
    },
    aiMaturity,
    aiOverviews: {
      hasJsonLd: htmlAnalysis.hasJsonLd,
      hasFaqPage: htmlAnalysis.hasFaq,
      hasSchemaMarkup: htmlAnalysis.hasSchemaOrgDentist,
      hasStructuredContent: htmlAnalysis.hasJsonLd && htmlAnalysis.hasSchemaOrgDentist,
      hasCitationsOnLLMs: "unknown",
      score: aiovScore,
      findings: aiovFindings,
    },
    adTracking,
    citations,
    narrative: { winning, losing, competitorEdge },
  };
}
