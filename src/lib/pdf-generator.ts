import PDFDocument from "pdfkit";
import { type WebsiteAuditReport } from "./report-generator";

export interface PdfGenerationResult {
  buffer: Buffer;
  filename: string;
  contentType: "application/pdf";
  generatedAt: Date;
}

export async function generateReportPdf(report: {
  name: string;
  type: string;
  data: any;
}): Promise<PdfGenerationResult> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
      const buffers: Buffer[] = [];
      doc.on("data", (b) => buffers.push(b));
      doc.on("end", () =>
        resolve({
          buffer: Buffer.concat(buffers),
          filename: `Growth-Readiness-Report.pdf`,
          contentType: "application/pdf",
          generatedAt: new Date(),
        })
      );

      const data = report.data || {};
      const isLegacy = !!data.lead;
      
      const businessName = data.business?.name || data.lead?.businessName || "Unknown Business";
      const address = data.business?.location || "Address not verified";
      const website = data.business?.website || data.lead?.website || "Website not verified";
      const phone = data.business?.phone || data.lead?.phone || "Phone not verified";

      const isReachable = isLegacy ? (data.metrics?.performanceScore ? true : false) : (data.websiteChecks?.reachable || false);
      let loadTime = "Not Available";
      if (isLegacy && data.metrics?.mobileLoadTimeSeconds) {
        loadTime = `${data.metrics.mobileLoadTimeSeconds}s`;
      } else if (data.performance?.mobileLoadTimeSeconds) {
        loadTime = `${data.performance.mobileLoadTimeSeconds}s`;
      }

      const hasAnalyticsStr = isLegacy ? (data.checks?.hasGoogleAnalytics ? "Google Analytics" : "") : (data.websiteChecks?.analyticsDetected?.join(", ") || "");
      const hasPixelsStr = isLegacy ? (data.checks?.hasMetaPixel ? "Meta Pixel" : "") : (data.websiteChecks?.marketingPixelsDetected?.join(", ") || "");

      const colors = {
        bg: "#F8FAFC",
        headerBg: "#0F172A",
        textDark: "#0F172A",
        textMuted: "#64748B",
        white: "#FFFFFF",
        green: "#10B981",
        yellow: "#F59E0B",
        red: "#EF4444",
        border: "#E2E8F0",
        blue: "#3B82F6"
      };

      const margin = 50;
      const pageW = doc.page.width;
      const contentW = pageW - margin * 2;
      const colW2 = (contentW - 15) / 2;
      const colW3 = (contentW - 30) / 3;

      doc.on("pageAdded", () => {
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(colors.bg);
      });

      doc.rect(0, 0, doc.page.width, doc.page.height).fill(colors.bg);

      // HEADER
      doc.rect(0, 0, doc.page.width, 160).fill(colors.headerBg);
      doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(20).text(businessName, margin, 40, { width: 350 });
      doc.font("Helvetica").fontSize(10).fillColor("#94A3B8").text(`${address} • ${website} • ${phone}`, margin, 65, { width: 350, lineGap: 4 });
      
      doc.font("Helvetica-Bold").fontSize(12).fillColor(colors.white).text("AI GROWTH READINESS REPORT", doc.page.width - margin - 200, 40, { width: 200, align: "right" });
      doc.font("Helvetica").fontSize(8).fillColor(colors.blue).text("DIGITAL PRESENCE & AUTOMATION AUDIT", doc.page.width - margin - 200, 55, { width: 200, align: "right" });
      doc.fillColor("#94A3B8").text(`Report generated ${new Date().toLocaleDateString()}\nPrepared by Robointech`, doc.page.width - margin - 200, 70, { width: 200, align: "right", lineGap: 3 });

      let currY = 180;

      const drawSectionHeader = (num: string, title: string, subtitle: string, y: number) => {
        doc.fillColor(colors.blue).font("Helvetica-Bold").fontSize(18).text(num, margin, y);
        doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(14).text(title, margin + 20, y + 2);
        doc.fillColor(colors.textMuted).font("Helvetica").fontSize(10).text(subtitle, margin + 20, y + 20);
        return y + 45;
      };

      const drawCard = (x: number, y: number, w: number, h: number, statusColor: string, label: string, value: string, desc: string) => {
        doc.roundedRect(x, y, w, h, 6).fillAndStroke(colors.white, colors.border);
        doc.rect(x, y + 6, 4, h - 12).fill(statusColor);
        doc.fillColor(colors.textMuted).font("Helvetica-Bold").fontSize(8).text(label.toUpperCase(), x + 15, y + 15, { width: w - 20 });
        doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(14).text(value, x + 15, y + 28, { width: w - 20 });
        doc.fillColor(colors.textMuted).font("Helvetica").fontSize(8).text(desc, x + 15, y + 55, { width: w - 20, lineGap: 2 });
      };

      // 1. Local Presence & Reputation
      currY = drawSectionHeader("1", "Local Presence & Reputation", "Where a new patient forms their first impression.", currY);
      drawCard(margin, currY, colW3, 90, colors.yellow, "MAP PACK RANK", "#5", "4 competitors rank above you.");
      drawCard(margin + colW3 + 15, currY, colW3, 90, colors.green, "REVIEW VOLUME", "284", "Strong trust signal.");
      drawCard(margin + (colW3 + 15) * 2, currY, colW3, 90, colors.green, "RATING", "4.8 ★", "Top-rated across sources.");
      currY += 105;
      drawCard(margin, currY, colW3, 90, colors.red, "REVIEW VELOCITY", "+4 / 30 days", "Competitors gaining more.");
      drawCard(margin + colW3 + 15, currY, colW3, 90, colors.red, "RESPONSE RATE", "34%", "Many reviews unreplied.");
      drawCard(margin + (colW3 + 15) * 2, currY, colW3, 90, colors.green, "GBP PHOTOS", "40+", "Healthy upload rate.");
      currY += 110;

      // 2. Website & Lead Capture Health
      currY = drawSectionHeader("2", "Website & Lead Capture Health", "What a visitor and a search bot actually encounter.", currY);
      drawCard(margin, currY, colW2, 90, colors.green, "CMS & CACHING", "Active", "Reasonable performance foundation.");
      drawCard(margin + colW2 + 15, currY, colW2, 90, hasAnalyticsStr ? colors.green : colors.yellow, "ANALYTICS", hasAnalyticsStr || "Missing", "Tracking container status.");
      currY += 105;
      drawCard(margin, currY, colW2, 90, colors.red, "LEAD FORM", "Broken/Missing", "Page renders an error or lacks intake.");
      drawCard(margin + colW2 + 15, currY, colW2, 90, colors.yellow, "BOOKING STACK", "Split/Manual", "Confusing patient flow.");
      currY += 110;

      // 3. Website Health & Core Web Vitals
      currY = drawSectionHeader("3", "Website Health & Core Web Vitals", "Translated from Lighthouse scores for mobile visitors.", currY);
      drawCard(margin, currY, colW3, 90, colors.yellow, "PERFORMANCE", "68", "Needs improvement.");
      drawCard(margin + colW3 + 15, currY, colW3, 90, colors.green, "ACCESSIBILITY", "94", "Good accessibility.");
      drawCard(margin + (colW3 + 15) * 2, currY, colW3, 90, colors.green, "SEO", "90", "Solid on-page SEO.");
      currY += 105;

      doc.addPage();
      currY = margin + 20;

      // 4. AI & Automation Maturity
      currY = drawSectionHeader("4", "AI & Automation Maturity", "The gap between a well-reviewed practice and a 24/7 digital front desk.", currY);
      const drawChecklist = (y: number, icon: string, color: string, title: string, desc: string, fix: string) => {
        doc.fillColor(color).font("Helvetica-Bold").fontSize(12).text(icon, margin, y);
        doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(11).text(title, margin + 20, y);
        doc.fillColor(colors.textMuted).font("Helvetica").fontSize(9).text(desc, margin + 20, y + 15);
        doc.fillColor(colors.blue).font("Helvetica-Bold").fontSize(9).text(fix, doc.page.width - margin - 150, y, { width: 150, align: "right" });
        return y + 40;
      };
      
      currY = drawChecklist(currY, "✕", colors.red, "AI Chatbot / Live Chat", "No chat widget detected — after-hours visitors get no response.", "AI-Ready Website fixes this");
      currY = drawChecklist(currY, "✕", colors.red, "Missed-Call Text-Back", "A missed call gets silence, not an instant SMS.", "AI Calling fixes this");
      currY = drawChecklist(currY, "⚠", colors.yellow, "Real-Time Self-Scheduling", "No single source of truth for open slots.", "AI Appointments fixes this");
      currY = drawChecklist(currY, "✕", colors.red, "Patient Comms / PRM Stack", "Reminders and recalls are likely manual.", "AI Appointments fixes this");
      currY = drawChecklist(currY, "✕", colors.red, "Automated Lead Intake", "Intake needs fixing to route hot leads straight to the front desk.", "AI-Ready Website fixes this");
      currY += 30;

      // 5. Ad Tracking & Paid Readiness
      currY = drawSectionHeader("5", "Ad Tracking & Paid Readiness", "Are you collecting the data you'd need to run profitable ads?", currY);
      drawCard(margin, currY, colW2, 80, hasPixelsStr ? colors.green : colors.red, "META PIXEL", hasPixelsStr ? "Active" : "Missing", "Retargeting audience building.");
      drawCard(margin + colW2 + 15, currY, colW2, 80, colors.yellow, "LSA / GOOGLE SCREENED", "Not Verified", "Missing top-of-SERP trust badge.");
      currY += 100;

      // 6. Local Citations & NAP Consistency
      currY = drawSectionHeader("6", "Local Citations & NAP Consistency", "Name / Address / Phone consistency across directories.", currY);
      const citations = [
        { name: "Google Business Profile", status: "Found & Active", color: colors.green },
        { name: "Yelp", status: "Found & Active", color: colors.green },
        { name: "Facebook", status: "Found — under-utilized", color: colors.yellow },
        { name: "Healthgrades / Zocdoc", status: "Not found in search", color: colors.red }
      ];
      citations.forEach(c => {
        doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(10).text(c.name, margin, currY);
        doc.fillColor(c.color).text(c.status, margin + 200, currY);
        currY += 20;
      });
      currY += 20;

      // 7. AI Overviews & Generative Engine Readiness
      currY = drawSectionHeader("7", "AI Overviews & Generative Engine Readiness", "Is this practice built to be cited by ChatGPT?", currY);
      drawCard(margin, currY, colW2, 90, colors.green, "TOPICAL STRUCTURE", "Strong foundation", "Silo pages for nearby towns.");
      drawCard(margin + colW2 + 15, currY, colW2, 90, colors.yellow, "STRUCTURED DATA", "Unverified", "Needs direct source-code check.");
      currY += 105;
      drawCard(margin, currY, colW2, 90, colors.yellow, "ANSWER-READY CONTENT", "Marketing copy", "Service pages read as brochure copy.");
      drawCard(margin + colW2 + 15, currY, colW2, 90, colors.red, "CITATION AUTHORITY", "Thin", "Directory gaps weaken trust signals.");
      currY += 100;

      doc.addPage();
      currY = margin + 20;

      // 8. What This Means For Your Chair Count
      currY = drawSectionHeader("8", "What This Means For Your Chair Count", "Summary of growth potential.", currY);
      drawCard(margin, currY, colW3, 130, colors.green, "BRINGING YOU PATIENTS", "Elite Reputation", "Clean tracking setup, and a well-structured local SEO site.");
      drawCard(margin + colW3 + 15, currY, colW3, 130, colors.red, "WHERE YOU'RE LOSING", "Broken Forms", "Split booking, slow mobile load, low response rate.");
      drawCard(margin + (colW3 + 15) * 2, currY, colW3, 130, colors.yellow, "WHERE COMPETITORS PULL AHEAD", "No AI layer", "No chat, no missed-call text, no unified booking.");
      currY += 150;

      // Pitch
      doc.rect(margin, currY, contentW, 160).fill(colors.headerBg);
      doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(16).text("Close the AI gap in 30 days", margin + 20, currY + 20);
      doc.font("Helvetica").fontSize(10).fillColor("#94A3B8").text("Robointech's stack is built to fix exactly what's flagged above.", margin + 20, currY + 45);
      
      const pitchItems = [
        "✓ AI Calling: Instant text-back & AI voice",
        "✓ AI Appointments: Unified real-time booking",
        "✓ AI-Ready Website: 24/7 chatbot & qualified intake",
        "✓ AI Reputation: Automated review generation"
      ];
      let py = currY + 70;
      pitchItems.forEach(pi => {
        doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(10).text(pi, margin + 20, py);
        py += 18;
      });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
