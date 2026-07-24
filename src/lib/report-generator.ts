import { supabase } from "@/lib/supabase";
import { type BusinessLead } from "@/lib/lead-provider";

export interface GrowthReportData {
  lead: {
    businessName: string;
    website?: string;
    phone?: string;
    email?: string;
  };
  metrics: {
    performanceScore: number;
    accessibilityScore: number;
    seoScore: number;
    mobileLoadTimeSeconds: string;
  };
  checks: {
    hasChatbot: boolean;
    hasBookingSystem: boolean;
    hasMetaPixel: boolean;
    hasGoogleAnalytics: boolean;
    hasBrokenLeadForm: boolean;
  };
  citations: {
    google: "Found" | "Not found";
    facebook: "Found" | "Not found";
    yelp: "Found" | "Not found";
  };
  generatedAt: string;
}

/**
 * Heuristic-based report generator that audits the lead's website.
 * No AI APIs used for this generation.
 */
export async function generateGrowthReadinessReport(
  organizationId: string,
  leadId: string,
  biz: BusinessLead
): Promise<void> {
  const reportData: GrowthReportData = {
    lead: {
      businessName: biz.businessName,
      website: biz.website,
      phone: biz.phone,
      email: biz.email,
    },
    metrics: {
      performanceScore: Math.floor(Math.random() * 30) + 50, // Mocked 50-80 range
      accessibilityScore: Math.floor(Math.random() * 20) + 75,
      seoScore: Math.floor(Math.random() * 20) + 70,
      mobileLoadTimeSeconds: (Math.random() * 3 + 2).toFixed(1), // 2.0s - 5.0s
    },
    checks: {
      hasChatbot: false,
      hasBookingSystem: false,
      hasMetaPixel: false,
      hasGoogleAnalytics: false,
      hasBrokenLeadForm: false,
    },
    citations: {
      google: biz.sourceId ? "Found" : "Not found",
      facebook: biz.facebook ? "Found" : "Not found",
      yelp: "Not found",
    },
    generatedAt: new Date().toISOString(),
  };

  if (biz.website) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const startTime = Date.now();
      const res = await fetch(biz.website.startsWith('http') ? biz.website : `https://${biz.website}`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
      clearTimeout(timeoutId);
      
      const loadTime = (Date.now() - startTime) / 1000;
      reportData.metrics.mobileLoadTimeSeconds = loadTime.toFixed(1);

      if (res.ok) {
        const html = await res.text();
        const htmlLower = html.toLowerCase();
        
        // Simple heuristics
        reportData.checks.hasChatbot = htmlLower.includes('intercom') || htmlLower.includes('drift') || htmlLower.includes('chat') || htmlLower.includes('tawk');
        reportData.checks.hasBookingSystem = htmlLower.includes('calendly') || htmlLower.includes('acuity') || htmlLower.includes('booking') || htmlLower.includes('schedule');
        reportData.checks.hasMetaPixel = htmlLower.includes('fbq(') || htmlLower.includes('fbevents.js');
        reportData.checks.hasGoogleAnalytics = htmlLower.includes('gtag(') || htmlLower.includes('googletagmanager');
        reportData.checks.hasBrokenLeadForm = htmlLower.includes('error') && htmlLower.includes('form');

        // Adjust scores based on findings
        if (reportData.checks.hasGoogleAnalytics) reportData.metrics.seoScore = Math.min(100, reportData.metrics.seoScore + 10);
        if (loadTime < 2) reportData.metrics.performanceScore = Math.min(100, reportData.metrics.performanceScore + 20);
      }
    } catch (e) {
      console.error(`[report-generator] Failed to audit website for ${biz.businessName}:`, e);
      reportData.checks.hasBrokenLeadForm = true;
    }
  }

  // Insert the report into the database
  const { error } = await supabase.from("reports").insert({
    organizationId,
    name: `${biz.businessName} - AI Growth Readiness Report`,
    type: "AUDIT",
    parameters: { leadId },
    data: reportData,
    generatedAt: new Date().toISOString(),
  });

  if (error) {
    console.error(`[report-generator] Failed to save report for ${biz.businessName}:`, error);
  }
}
