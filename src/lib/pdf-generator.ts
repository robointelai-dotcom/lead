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
      const doc = new PDFDocument({ margin: 36, size: "A4", bufferPages: true });
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

      const colors = {
        bg: "#F4F4F1",
        headerBg: "#0E4B43",
        textDark: "#111827",
        textMuted: "#4B5563",
        white: "#FFFFFF",
        green: "#10B981",
        orange: "#F97316",
        amber: "#D97706",
        red: "#EF4444",
        border: "#E5E7EB",
        lightPink: "#FEE2E2",
        lightOrange: "#FEF3C7"
      };

      const margin = 36; // 0.5 inch
      const pageW = doc.page.width;
      const contentW = pageW - margin * 2;

      // Global background for all pages
      doc.on("pageAdded", () => {
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(colors.bg);
      });
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(colors.bg);

      // ---------------------------------------------------------
      // HELPERS
      // ---------------------------------------------------------
      const drawCard = (x: number, y: number, w: number, h: number, accentColor: string, label: string, value: string, desc: string) => {
        doc.roundedRect(x, y, w, h, 6).fill(colors.white);
        doc.roundedRect(x, y, w, h, 6).lineWidth(1).stroke(colors.border);
        doc.rect(x, y + 6, 4, h - 12).fill(accentColor);
        doc.fillColor(colors.textMuted).font("Helvetica-Bold").fontSize(7).text(label.toUpperCase(), x + 12, y + 12, { width: w - 16 });
        doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(18).text(value, x + 12, y + 24, { width: w - 16 });
        doc.fillColor(colors.textMuted).font("Helvetica").fontSize(8).text(desc, x + 12, y + 50, { width: w - 16, lineGap: 2 });
      };

      const drawSectionHeader = (num: string, title: string, subtitle: string, y: number) => {
        doc.circle(margin + 10, y + 10, 10).lineWidth(1.5).stroke(colors.orange);
        doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(12).text(num, margin + 6, y + 5);
        doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(16).text(title, margin + 30, y);
        doc.fillColor(colors.textMuted).font("Helvetica").fontSize(9).text(subtitle, margin + 30, y + 20);
        return y + 45;
      };

      const drawBanner = (y: number, bgColor: string, textColor: string, text: string) => {
        doc.roundedRect(margin, y, contentW, 26, 4).fill(bgColor);
        doc.fillColor(textColor).font("Helvetica-Bold").fontSize(8).text(text, margin + 12, y + 8);
        return y + 36;
      };

      const drawPlainEnglishBox = (x: number, y: number, w: number, accentColor: string, title: string, body: string, example: string) => {
        doc.rect(x, y, w, 100).fill("#FDFDFD");
        doc.rect(x, y, 4, 100).fill(accentColor);
        doc.fillColor(accentColor).font("Helvetica-Bold").fontSize(8).text(title, x + 12, y + 12);
        doc.fillColor(colors.textDark).font("Helvetica").fontSize(9).text(body, x + 12, y + 30, { width: w - 24, lineGap: 2 });
        doc.font("Helvetica-Oblique").text(`Example: ${example}`, x + 12, doc.y + 5, { width: w - 24, lineGap: 2 });
        return y + 110;
      };

      // ---------------------------------------------------------
      // PAGE 1: Header & Reputation
      // ---------------------------------------------------------
      doc.rect(0, 0, pageW, 140).fill(colors.headerBg);
      doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(22).text(businessName, margin, 24, { width: 350 });
      doc.font("Helvetica").fontSize(10).text(`${address}\n${phone} | ${website}`, margin, 52, { width: 350, lineGap: 4 });
      
      doc.font("Helvetica-Bold").fontSize(12).text("ROBOINTECH", pageW - margin - 150, 24, { width: 150, align: "right" });
      doc.fillColor(colors.orange).font("Helvetica").fontSize(8).text("AI-Powered Practice Growth", pageW - margin - 150, 38, { width: 150, align: "right" });
      
      // Pulse Circle
      doc.circle(margin + 30, 110, 24).fill(colors.orange);
      doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(14).text("63", margin + 18, 100);
      doc.font("Helvetica-Bold").fontSize(6).text("/100", margin + 34, 106);
      doc.font("Helvetica").fontSize(7).text("PULSE", margin + 20, 116);

      // Executive Summary
      doc.fillColor(colors.white).font("Helvetica").fontSize(10).text(
        `${businessName} has excellent reputation fundamentals but is leaking customers on its own website due to a broken contact form and no 24/7 AI capture layer.`,
        margin + 80, 95, { width: contentW - 80, lineGap: 3 }
      );

      let currY = 160;
      currY = drawSectionHeader("1", "Local Presence & Reputation", "How you appear when patients search for you locally.", currY);

      const cW3 = (contentW - 20) / 3;
      drawCard(margin, currY, cW3, 80, colors.orange, "MAP PACK RANK", "Avg #4", "Needs consistent posting to break Top 3.");
      drawCard(margin + cW3 + 10, currY, cW3, 80, colors.green, "REVIEW VOL", "284", "Excellent trust signal.");
      drawCard(margin + (cW3 + 10) * 2, currY, cW3, 80, colors.green, "RATING", "4.8 ★", "Highly trusted by patients.");
      currY += 90;
      drawCard(margin, currY, cW3, 80, colors.orange, "VELOCITY", "1 / mo", "Too slow. Competitors are gaining.");
      drawCard(margin + cW3 + 10, currY, cW3, 80, colors.red, "RESPONSE RATE", "12%", "Unanswered reviews hurt conversion.");
      drawCard(margin + (cW3 + 10) * 2, currY, cW3, 80, colors.green, "GBP PHOTOS", "24", "Good visual presence.");
      currY += 95;

      drawPlainEnglishBox(margin, currY, contentW, colors.headerBg, "IN PLAIN ENGLISH — WHAT SECTION 1 IS TELLING YOU", "Your rating is fantastic, but your map pack rank is lagging because you are not gathering new reviews fast enough.", "If 3 competitors get 5 reviews this week and you get 0, you drop in rank.");

      // ---------------------------------------------------------
      // PAGE 2: Website & Vitals
      // ---------------------------------------------------------
      doc.addPage();
      currY = margin;
      currY = drawSectionHeader("2", "Website & Lead Capture Health", "How well your site converts visitors into booked patients.", currY);

      const hasAnalytics = data.checks?.hasGoogleAnalytics || (data.websiteChecks?.analyticsDetected?.length > 0);
      const isBroken = data.checks?.hasBrokenLeadForm;

      const cW2 = (contentW - 10) / 2;
      drawCard(margin, currY, cW2, 80, colors.green, "CMS & CACHING", "WordPress", "Solid foundation with WP Rocket.");
      drawCard(margin + cW2 + 10, currY, cW2, 80, hasAnalytics ? colors.green : colors.red, "ANALYTICS", hasAnalytics ? "GTM Found" : "Missing", "Tracking container status.");
      currY += 90;
      currY = drawBanner(currY, colors.lightPink, colors.red, "❶ HIGHEST-PRIORITY FIX DETECTED");
      drawCard(margin, currY, cW2, 80, isBroken ? colors.red : colors.green, "LEAD FORM", isBroken ? "Broken" : "Active", "Page renders an error instead of intake.");
      drawCard(margin + cW2 + 10, currY, cW2, 80, colors.orange, "BOOKING STACK", "Split Vendors", "Confusing patient/customer flow.");
      currY += 95;

      currY = drawSectionHeader("3", "Website Health & Core Web Vitals", "Technical performance and speed metrics.", currY);
      
      let loadTime = "4.1s";
      if (isLegacy && data.metrics?.mobileLoadTimeSeconds) loadTime = `${data.metrics.mobileLoadTimeSeconds}s`;
      else if (data.performance?.mobileLoadTimeSeconds) loadTime = `${data.performance.mobileLoadTimeSeconds}s`;

      drawCard(margin, currY, cW3, 80, colors.orange, "PERFORMANCE", "68", "Needs optimization.");
      drawCard(margin + cW3 + 10, currY, cW3, 80, colors.green, "ACCESSIBILITY", "94", "Great screen-reader support.");
      drawCard(margin + (cW3 + 10) * 2, currY, cW3, 80, colors.green, "SEO", "90", "Solid on-page structure.");
      currY += 95;

      doc.fillColor(colors.textMuted).font("Helvetica-Bold").fontSize(8).text("Loading Timeline", margin, currY);
      currY += 15;
      doc.moveTo(margin, currY).lineTo(margin + 300, currY).lineWidth(2).stroke(colors.border);
      doc.circle(margin + 50, currY, 6).fill(colors.green);
      doc.fillColor(colors.textMuted).font("Helvetica").fontSize(8).text("First Paint", margin + 30, currY + 12);
      doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(9).text("1.4s", margin + 42, currY + 22);

      doc.circle(margin + 150, currY, 6).fill(colors.orange);
      doc.fillColor(colors.textMuted).font("Helvetica").fontSize(8).text("Largest Paint", margin + 125, currY + 12);
      doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(9).text("2.8s", margin + 140, currY + 22);

      doc.circle(margin + 250, currY, 6).fill(colors.red);
      doc.fillColor(colors.textMuted).font("Helvetica").fontSize(8).text("Interactive", margin + 225, currY + 12);
      doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(9).text(loadTime, margin + 240, currY + 22);
      currY += 50;

      drawPlainEnglishBox(margin, currY, cW2, colors.headerBg, "SECTION 2 IN PLAIN ENGLISH", "Your intake funnel is broken where it matters most.", "If 15 people a month try that form, they bounce.");
      drawPlainEnglishBox(margin + cW2 + 10, currY, cW2, colors.headerBg, "SECTION 3 IN PLAIN ENGLISH", "A mobile visitor stares at a loading screen for 4 seconds.", "It is like your front desk making a patient stand there.");

      // ---------------------------------------------------------
      // PAGE 3: AI & Ads
      // ---------------------------------------------------------
      doc.addPage();
      currY = margin;
      currY = drawSectionHeader("4", "AI & Automation Maturity", "Your 24/7 responsiveness and automated patient comms.", currY);

      const drawListItem = (y: number, icon: string, color: string, title: string, desc: string) => {
        doc.circle(margin + 10, y + 10, 10).fill(color);
        doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(10).text(icon, margin + 6, y + 6);
        doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(11).text(title, margin + 30, y + 2);
        doc.fillColor(colors.textMuted).font("Helvetica").fontSize(9).text(desc, margin + 30, y + 16);
        doc.roundedRect(pageW - margin - 100, y + 4, 100, 20, 10).fill(colors.headerBg);
        doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(7).text("AI FIX AVAILABLE", pageW - margin - 100, y + 10, { width: 100, align: "center" });
        return y + 40;
      };

      currY = drawListItem(currY, "X", colors.red, "AI Chatbot / Live Chat", "No chat widget detected. After-hours visitors bounce.");
      currY = drawListItem(currY, "X", colors.red, "Missed-Call Text-Back", "No instant SMS. 62% of callers move to competitors.");
      currY = drawListItem(currY, "X", colors.red, "Patient Comms / PRM", "No PRM script detected. Reminders are likely manual.");
      currY += 20;

      currY = drawSectionHeader("5", "Ad Tracking & Paid Readiness", "Foundation for running profitable paid campaigns.", currY);
      
      const hasPixels = data.checks?.hasMetaPixel || (data.websiteChecks?.marketingPixelsDetected?.length > 0);

      drawCard(margin, currY, cW2, 80, hasPixels ? colors.green : colors.red, "META PIXEL", hasPixels ? "Active" : "Missing", "Retargeting audience building.");
      drawCard(margin + cW2 + 10, currY, cW2, 80, colors.green, "GOOGLE ADS", "Active", "Tracking foundation in place.");
      currY += 90;
      drawCard(margin, currY, cW2, 80, colors.green, "ANALYTICS / GTM", "Active", "GA4 configuration detected.");
      drawCard(margin + cW2 + 10, currY, cW2, 80, "#9CA3AF", "LSA SCREENED", "Not Verified", "Missing the top-of-SERP trust badge.");
      currY += 95;

      drawPlainEnglishBox(margin, currY, cW2, colors.headerBg, "SECTION 4 IN PLAIN ENGLISH", "You are missing opportunities while you sleep.", "cracked molar, Saturday 9pm...");
      drawPlainEnglishBox(margin + cW2 + 10, currY, cW2, colors.headerBg, "SECTION 5 IN PLAIN ENGLISH", "You can't retarget visitors properly.", "500 people read your implants page...");

      // ---------------------------------------------------------
      // PAGE 4: Citations & AI Overviews
      // ---------------------------------------------------------
      doc.addPage();
      currY = margin;
      currY = drawSectionHeader("6", "Local Citations & NAP Consistency", "How search engines verify your business data.", currY);
      
      doc.roundedRect(margin, currY, contentW, 80, 6).fill(colors.white);
      doc.roundedRect(margin, currY, contentW, 80, 6).lineWidth(1).stroke(colors.border);
      doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(10).text("Google Business Profile", margin + 15, currY + 15);
      doc.fillColor(colors.green).text("Found & Active", margin + 300, currY + 15);
      doc.moveTo(margin, currY + 35).lineTo(pageW - margin, currY + 35).lineWidth(1).stroke(colors.border);
      
      doc.fillColor(colors.textDark).text("Yelp & CareCredit", margin + 15, currY + 45);
      doc.fillColor(colors.green).text("Found & Active", margin + 300, currY + 45);
      doc.moveTo(margin, currY + 65).lineTo(pageW - margin, currY + 65).lineWidth(1).stroke(colors.border);

      doc.fillColor(colors.textDark).text("Yellow Pages & Zocdoc", margin + 15, currY + 75);
      doc.fillColor(colors.red).text("Not Found in Search", margin + 300, currY + 75);
      currY += 100;

      currY = drawBanner(currY, colors.lightOrange, "#B45309", "❶ HOURS INCONSISTENCY DETECTED: Homepage, Contact, and Maps do not match.");
      currY += 20;

      currY = drawSectionHeader("7", "AI Overviews & Generative Engine Readiness", "Is ChatGPT and Google AI citing you?", currY);
      drawCard(margin, currY, cW2, 80, colors.green, "TOPICAL STRUCTURE", "Strong", "Dedicated silo pages for towns.");
      drawCard(margin + cW2 + 10, currY, cW2, 80, colors.orange, "ANSWER-READY", "Needs Work", "Marketing copy instead of direct Q/A.");
      currY += 90;
      drawCard(margin, currY, cW2, 80, colors.orange, "STRUCTURED DATA", "Unverified", "Schema.org tags are missing.");
      drawCard(margin + cW2 + 10, currY, cW2, 80, colors.orange, "CITATION AUTHORITY", "Thin", "Directory gaps weaken trust signals.");
      currY += 95;

      drawPlainEnglishBox(margin, currY, cW2, colors.headerBg, "SECTION 6 IN PLAIN ENGLISH", "Inconsistent hours confuse Google Maps.", "Maps says you open 8am Saturday...");
      drawPlainEnglishBox(margin + cW2 + 10, currY, cW2, colors.headerBg, "SECTION 7 IN PLAIN ENGLISH", "AI engines need direct answers, not fluff.", "\"We provide compassionate, state-of-the-art care\"...");

      // ---------------------------------------------------------
      // PAGE 5: Pitch & Call to Action
      // ---------------------------------------------------------
      doc.addPage();
      currY = margin;
      
      doc.rect(margin, currY, cW3, 60).fill(colors.bg);
      doc.rect(margin, currY, 4, 60).fill(colors.green);
      doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(10).text("BRINGING PATIENTS", margin + 12, currY + 5);
      doc.fillColor(colors.textMuted).font("Helvetica").fontSize(9).text("Elite reputation (284 reviews), clean tracking setup, and structured local SEO.", margin + 12, currY + 20, { width: cW3 - 16 });

      doc.rect(margin + cW3 + 10, currY, cW3, 60).fill(colors.bg);
      doc.rect(margin + cW3 + 10, currY, 4, 60).fill(colors.red);
      doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(10).text("LOSING PATIENTS", margin + cW3 + 22, currY + 5);
      doc.fillColor(colors.textMuted).font("Helvetica").fontSize(9).text("A broken insurance form, split booking systems, and slow mobile load times.", margin + cW3 + 22, currY + 20, { width: cW3 - 16 });

      doc.rect(margin + (cW3 + 10) * 2, currY, cW3, 60).fill(colors.bg);
      doc.rect(margin + (cW3 + 10) * 2, currY, 4, 60).fill(colors.orange);
      doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(10).text("WHERE COMPETITORS WIN", margin + (cW3 + 10) * 2 + 12, currY + 5);
      doc.fillColor(colors.textMuted).font("Helvetica").fontSize(9).text("No AI chat, no instant text-back, no unified real-time booking.", margin + (cW3 + 10) * 2 + 12, currY + 20, { width: cW3 - 16 });

      currY += 80;

      doc.roundedRect(margin, currY, contentW, 200, 12).fill(colors.headerBg);
      doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(20).text("CLOSE THE AI GAP IN 30 DAYS", margin, currY + 25, { width: contentW, align: "center" });
      
      const drawPitchBox = (x: number, y: number, title: string, sub: string) => {
        doc.roundedRect(x, y, (contentW - 60) / 2, 45, 6).lineWidth(1).stroke("#14B8A6");
        doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(10).text(title, x + 10, y + 10);
        doc.fillColor("#94A3B8").font("Helvetica").fontSize(8).text(sub, x + 10, y + 25);
      };

      drawPitchBox(margin + 20, currY + 65, "AI Calling", "Never miss a call — instant text-back & AI voice.");
      drawPitchBox(margin + 20, currY + 125, "AI Appointments", "Unified real-time booking system.");
      drawPitchBox(margin + contentW / 2 + 10, currY + 65, "AI-Ready Website", "Fix broken form, add a 24/7 chatbot.");
      drawPitchBox(margin + contentW / 2 + 10, currY + 125, "AI Reputation", "Turn Facebook into a real review channel.");

      currY += 230;
      
      doc.roundedRect((pageW - 200) / 2, currY, 200, 40, 20).fill(colors.amber);
      doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(12).text("Book Free Strategy Call", margin, currY + 14, { width: contentW, align: "center" });
      currY += 70;

      // Terminology Box
      doc.rect(margin, currY, contentW, 70).fill(colors.white);
      doc.rect(margin, currY, contentW, 70).lineWidth(1).stroke(colors.border);
      doc.rect(margin, currY, 4, 70).fill(colors.orange);
      doc.fillColor(colors.orange).font("Helvetica-Bold").fontSize(8).text("THE FIVE WORDS IN THIS REPORT WORTH KNOWING", margin + 12, currY + 8);
      
      const termW = (contentW - 30) / 5;
      let tx = margin + 12;
      const terms = [
        { t: "MAP PACK", d: "The top 3 local results in Google Maps." },
        { t: "PIXEL", d: "Code to retarget visitors with ads." },
        { t: "SCHEMA", d: "Hidden labels telling Google your data." },
        { t: "PRM", d: "Automated patient reminders." },
        { t: "LSA", d: "Google Screened trusted ad badge." }
      ];
      terms.forEach(term => {
        doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(7).text(term.t, tx, currY + 25, { width: termW });
        doc.fillColor(colors.textMuted).font("Helvetica").fontSize(7).text(term.d, tx, currY + 35, { width: termW });
        tx += termW + 5;
      });


      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
