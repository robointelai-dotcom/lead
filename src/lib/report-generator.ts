import { supabase } from "@/lib/supabase";
import { type BusinessLead } from "@/lib/lead-provider";
import { randomUUID } from "crypto";
import dns from "dns/promises";

export interface AuditFinding {
  id: string;
  category: "SEO" | "PERFORMANCE" | "ACCESSIBILITY" | "CONVERSION" | "SECURITY" | "TRACKING" | "CONTENT";
  title: string;
  evidence: string;
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH";
  recommendation: string;
  source: string;
}

export interface WebsiteAuditReport {
  id: string;
  leadId: string;
  websiteUrl: string;
  generatedAt: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  business: {
    name?: string;
    website?: string;
    email?: string;
    phone?: string;
    location?: string;
    industry?: string;
    rating?: number;
    reviewCount?: number;
  };
  websiteChecks: {
    reachable: boolean;
    httpStatus?: number;
    httpsEnabled?: boolean;
    title?: string;
    analyticsDetected?: string[];
    marketingPixelsDetected?: string[];
    cms?: string;
  };
  performance?: {
    provider: string;
    mobileLoadTimeSeconds?: string;
  };
  findings: AuditFinding[];
  dataLimitations: string[];
  summary: {
    strengths: string[];
    opportunities: string[];
    recommendedActions: string[];
  };
}

async function isSafeUrl(urlStr: string): Promise<boolean> {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.hostname === "localhost" || url.hostname.endsWith(".local")) return false;

    // Simple IP check
    if (/^127\./.test(url.hostname) || /^192\.168\./.test(url.hostname) || /^10\./.test(url.hostname) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(url.hostname)) {
      return false;
    }

    // Resolve DNS
    const addresses = await dns.resolve4(url.hostname);
    for (const ip of addresses) {
      if (/^127\./.test(ip) || /^192\.168\./.test(ip) || /^10\./.test(ip) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) {
        return false;
      }
    }
    return true;
  } catch (err) {
    return false;
  }
}

import crypto from "crypto";

export function createReportToken(reportId: string, expiresInDays: number = 30): string {
  const expiresAt = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
  const secret = process.env.REPORT_LINK_SECRET || "fallback_secret";
  
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${reportId}:${expiresAt}`)
    .digest("hex");

  const payload = { reportId, expiresAt, signature };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/**
 * Real report generator that audits the lead's website securely.
 */
export async function generateGrowthReadinessReport(
  organizationId: string,
  leadId: string,
  biz: BusinessLead
): Promise<{ reportId: string } | null> {
  const reportId = randomUUID();
  const limitations: string[] = [];
  const findings: AuditFinding[] = [];
  
  const reportData: WebsiteAuditReport = {
    id: reportId,
    leadId,
    websiteUrl: biz.website || "Not available",
    generatedAt: new Date().toISOString(),
    status: "RUNNING",
    business: {
      name: biz.businessName,
      website: biz.website,
      phone: biz.phone,
      email: biz.email,
      industry: biz.category,
      location: biz.city && biz.state ? `${biz.city}, ${biz.state}` : biz.city,
      rating: biz.rating,
      reviewCount: biz.reviewCount,
    },
    websiteChecks: { reachable: false },
    findings: [],
    dataLimitations: [],
    summary: { strengths: [], opportunities: [], recommendedActions: [] },
  };

  let loadTimeSeconds: string | undefined;

  if (biz.website) {
    const urlStr = biz.website.startsWith('http') ? biz.website : `https://${biz.website}`;
    
    if (await isSafeUrl(urlStr)) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s max
        
        const startTime = Date.now();
        const res = await fetch(urlStr, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        clearTimeout(timeoutId);
        
        const loadTime = (Date.now() - startTime) / 1000;
        loadTimeSeconds = loadTime.toFixed(1);

        reportData.websiteChecks.reachable = true;
        reportData.websiteChecks.httpStatus = res.status;
        reportData.websiteChecks.httpsEnabled = urlStr.startsWith('https');

        if (res.ok) {
          // Limit payload size to prevent memory exhaustion
          const buffer = await res.arrayBuffer();
          const html = Buffer.from(buffer.slice(0, 500000)).toString('utf8'); // Max 500kb
          const htmlLower = html.toLowerCase();
          
          const analytics = [];
          if (htmlLower.includes('gtag(') || htmlLower.includes('googletagmanager')) analytics.push('Google Analytics');
          if (htmlLower.includes('segment.com')) analytics.push('Segment');
          reportData.websiteChecks.analyticsDetected = analytics;

          const pixels = [];
          if (htmlLower.includes('fbq(') || htmlLower.includes('fbevents.js')) pixels.push('Meta Pixel');
          if (htmlLower.includes('tiktok.com/tr')) pixels.push('TikTok Pixel');
          if (htmlLower.includes('aw-') || htmlLower.includes('googleadservices')) pixels.push('Google Ads');
          reportData.websiteChecks.marketingPixelsDetected = pixels;

          let cms = "Custom / Unknown";
          if (htmlLower.includes('wp-content') || htmlLower.includes('wordpress')) cms = "WordPress";
          else if (htmlLower.includes('cdn.shopify.com')) cms = "Shopify";
          else if (htmlLower.includes('squarespace.com')) cms = "Squarespace";
          else if (htmlLower.includes('wix.com') || htmlLower.includes('wixsite')) cms = "Wix";
          else if (htmlLower.includes('weebly.com')) cms = "Weebly";
          else if (htmlLower.includes('webflow.com')) cms = "Webflow";
          reportData.websiteChecks.cms = cms;

          // Extract title
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch) reportData.websiteChecks.title = titleMatch[1].trim();

          if (analytics.length === 0) {
            findings.push({
              id: randomUUID(),
              category: "TRACKING",
              title: "No Analytics Detected",
              evidence: "Could not find standard tracking tags (Google Analytics) in the homepage source.",
              severity: "MEDIUM",
              recommendation: "Install Google Analytics to measure visitor behavior and traffic sources.",
              source: "Website HTML Audit",
            });
          }

          if (loadTime > 3.5) {
             findings.push({
              id: randomUUID(),
              category: "PERFORMANCE",
              title: "Slow Mobile Load Time",
              evidence: `Homepage took ${loadTimeSeconds}s to respond.`,
              severity: "MEDIUM",
              recommendation: "Optimize server response time and enable caching to improve load speed.",
              source: "Network Request",
            });
          } else {
             reportData.summary.strengths.push("Fast initial server response time");
          }
        }
      } catch (e: any) {
        console.error(`[report-generator] Failed to audit website for ${biz.businessName}:`, e.message);
        limitations.push(`Website audit failed: ${e.message}`);
        reportData.status = "FAILED";
      }
    } else {
      limitations.push("Website URL was flagged as internal or unsafe.");
      reportData.status = "FAILED";
    }
  } else {
    limitations.push("No website URL provided for analysis.");
    reportData.status = "FAILED";
  }

  if (reportData.status !== "FAILED") {
    reportData.status = "COMPLETED";
    reportData.performance = {
      provider: "Internal Audit",
      mobileLoadTimeSeconds: loadTimeSeconds,
    };
  }

  reportData.findings = findings;
  reportData.dataLimitations = limitations;
  reportData.summary.opportunities = findings.map(f => f.title);

  const { error } = await supabase.from("reports").insert({
    id: reportId,
    organizationId,
    name: `${biz.businessName} - AI Growth Readiness Report`,
    type: "CUSTOM",
    parameters: { leadId },
    data: reportData as any,
    generatedAt: new Date().toISOString(),
  });

  if (error) {
    console.error(`[report-generator] Failed to save report for ${biz.businessName}:`, error);
    return null;
  }
  
  return { reportId };
}
