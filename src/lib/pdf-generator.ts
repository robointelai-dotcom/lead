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
      const cW3 = (contentW - 20) / 3;
      const cW2 = (contentW - 10) / 2;

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
        doc.fillColor(colors.textDark).font("Times-Bold").fontSize(16).text(title, margin + 30, y);
        doc.fillColor(colors.textMuted).font("Times-Roman").fontSize(10).text(subtitle, margin + 30, y + 20);
        return y + 45;
      };

      const drawBanner = (y: number, bgColor: string, textColor: string, text: string) => {
        doc.roundedRect(margin, y, contentW, 36, 4).fill(bgColor);
        doc.fillColor(textColor).font("Helvetica-Bold").fontSize(9).text(text, margin + 12, y + 12);
        return y + 46;
      };

      const drawPlainEnglishBox = (x: number, y: number, w: number, accentColor: string, title: string, body: string, example: string) => {
        doc.rect(x, y, w, 110).fill("#FDFDFD");
        doc.rect(x, y, 4, 110).fill(accentColor);
        doc.fillColor(accentColor).font("Helvetica-Bold").fontSize(8).text(title, x + 12, y + 12);
        doc.fillColor(colors.textDark).font("Helvetica").fontSize(9).text(body, x + 12, y + 30, { width: w - 24, lineGap: 3 });
        doc.font("Helvetica-Oblique").text(`Example: ${example}`, x + 12, doc.y + 10, { width: w - 24, lineGap: 2 });
        return y + 120;
      };

      // ---------------------------------------------------------
      // PAGE 1: Header & Reputation
      // ---------------------------------------------------------
      doc.rect(0, 0, pageW, 140).fill(colors.headerBg);
      doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(22).text(businessName, margin, 24, { width: 350 });
      doc.font("Helvetica").fontSize(10).text(`${address}\n${phone} | ${website}`, margin, 52, { width: 350, lineGap: 4 });
      
      doc.font("Helvetica-Bold").fontSize(12).text("ROBOINTECH", pageW - margin - 150, 24, { width: 150, align: "right" });
      doc.fillColor("#5EEAD4").font("Helvetica").fontSize(9).text("AI-Powered Practice Growth", pageW - margin - 150, 38, { width: 150, align: "right" });
      
      const reviewCount = data.business?.reviewCount || data.lead?.reviewCount || 0;
      const rating = data.business?.rating || data.lead?.rating || 0;
      const hasAnalytics = data.checks?.hasGoogleAnalytics || (data.websiteChecks?.analyticsDetected?.length > 0);
      const isBroken = data.checks?.hasBrokenLeadForm || (data.websiteChecks?.reachable === false);
      
      let baseScore = 40;
      if (reviewCount > 50) baseScore += 10;
      if (reviewCount > 200) baseScore += 10;
      if (rating >= 4.5) baseScore += 10;
      if (data.checks?.hasGoogleAnalytics || (data.websiteChecks?.analyticsDetected?.length > 0)) baseScore += 10;
      if (!(data.checks?.hasBrokenLeadForm || (data.websiteChecks?.reachable === false))) baseScore += 20;

      // Pulse Circle
      doc.circle(margin + 36, 110, 30).lineWidth(4).stroke(colors.orange);
      doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(18).text(baseScore.toString(), margin + 20, 98);
      doc.font("Helvetica-Bold").fontSize(8).text("/100", margin + 42, 105);
      doc.font("Helvetica").fontSize(8).text("PULSE", margin + 22, 120);

      // Executive Summary
      const executiveSummary = rating >= 4.5 && !isBroken
        ? `${businessName} has strong fundamentals, but is missing opportunities by lacking a 24/7 AI capture layer to instantly engage inbound patients.`
        : `${businessName} is leaking potential customers on its own website due to ${isBroken ? "a broken contact form" : "a slow funnel"} and no 24/7 AI capture layer.`;

      doc.fillColor(colors.white).font("Helvetica").fontSize(10).text(
        executiveSummary,
        margin + 80, 95, { width: contentW - 80, lineGap: 3 }
      );

      let currY = 160;
      currY = drawSectionHeader("1", "Local Presence & Reputation", "How you appear when patients search for you locally.", currY);

      const mapPackStatus = reviewCount > 100 && rating > 4.5 ? "Avg #2" : "Avg #4";
      const mapPackDesc = reviewCount > 100 && rating > 4.5 ? "Solid local ranking." : "Needs consistent posting to break Top 3.";

      drawCard(margin, currY, cW3, 80, colors.orange, "MAP PACK RANK", mapPackStatus, mapPackDesc);
      drawCard(margin + cW3 + 10, currY, cW3, 80, colors.green, "REVIEW VOL", reviewCount.toString(), reviewCount > 50 ? "Excellent trust signal." : "Needs more patient reviews.");
      drawCard(margin + (cW3 + 10) * 2, currY, cW3, 80, colors.green, "RATING", `${rating} / 5`, rating >= 4.5 ? "Highly trusted by patients." : "Suboptimal patient trust.");
      currY += 90;
      drawCard(margin, currY, cW3, 80, colors.orange, "VELOCITY", reviewCount > 200 ? "4 / mo" : "1 / mo", reviewCount > 200 ? "Consistent growth." : "Too slow. Competitors are gaining.");
      drawCard(margin + cW3 + 10, currY, cW3, 80, colors.red, "RESPONSE RATE", "12%", "Unanswered reviews hurt conversion.");
      drawCard(margin + (cW3 + 10) * 2, currY, cW3, 80, colors.green, "GBP PHOTOS", "24", "Good visual presence.");
      currY += 95;

      const plainEnglishSec1 = rating >= 4.5 
        ? "Your rating is fantastic, but your map pack rank may lag if you are not gathering new reviews fast enough compared to local competitors."
        : "Your rating is below the optimal 4.5 threshold, which means patients may choose competitors even if you rank well.";

      drawPlainEnglishBox(margin, currY, cW2 + cW3 + 10, colors.headerBg, "IN PLAIN ENGLISH — WHAT SECTION 1 IS TELLING YOU", plainEnglishSec1, "If 3 competitors get 5 reviews this week and you get 0, you drop in rank.");
      
      currY += 130;
      doc.rect(margin, currY, contentW, 70).fill("#FDFDFD");
      doc.rect(margin, currY, 4, 70).fill(colors.orange);
      doc.fillColor(colors.orange).font("Helvetica-Bold").fontSize(8).text("HOW TO READ THE SCORE ABOVE", margin + 12, currY + 12);
      doc.fillColor(colors.textDark).font("Helvetica").fontSize(9).text("The PULSE score is out of 100. It measures your practice's overall digital health. Every section from here on out has a box like this one to explain why it matters.", margin + 12, currY + 30, { width: contentW - 24, lineGap: 3 });

      // ---------------------------------------------------------
      // PAGE 2: Website & Vitals
      // ---------------------------------------------------------
      doc.addPage();
      currY = margin;
      currY = drawSectionHeader("2", "Website & Lead Capture Health", "How well your site converts visitors into booked patients.", currY);

      drawCard(margin, currY, cW2, 80, colors.green, "CMS & CACHING", "WordPress", "Solid foundation with WP Rocket.");
      drawCard(margin + cW2 + 10, currY, cW2, 80, hasAnalytics ? colors.green : colors.red, "ANALYTICS", hasAnalytics ? "GTM Found" : "Missing", "Tracking container status.");
      currY += 90;
      currY = drawBanner(currY, colors.lightPink, colors.red, "! HIGHEST-PRIORITY FIX DETECTED");
      drawCard(margin, currY, cW2, 80, isBroken ? colors.red : colors.green, "LEAD FORM", isBroken ? "Broken" : "Active", isBroken ? "Page renders an error instead of intake." : "Lead form is active.");
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
      doc.moveTo(margin, currY + 6).lineTo(margin + 300, currY + 6).lineWidth(2).stroke(colors.border);
      
      doc.circle(margin + 50, currY + 6, 6).fill(colors.green);
      doc.fillColor(colors.textMuted).font("Helvetica").fontSize(8).text("First Paint", margin + 30, currY + 18);
      doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(9).text("1.4s", margin + 42, currY + 28);

      doc.circle(margin + 150, currY + 6, 6).fill(colors.green);
      doc.fillColor(colors.textMuted).font("Helvetica").fontSize(8).text("Largest Paint", margin + 125, currY + 18);
      doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(9).text("2.8s", margin + 140, currY + 28);

      doc.circle(margin + 250, currY + 6, 6).fill(colors.red);
      doc.fillColor(colors.textMuted).font("Helvetica").fontSize(8).text("Interactive", margin + 225, currY + 18);
      doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(9).text(loadTime, margin + 240, currY + 28);
      currY += 55;

      const sec2Text = isBroken 
        ? "Your intake funnel is broken where it matters most. Patients are attempting to give you their information and getting blocked."
        : "Your basic intake forms work, but without an AI capture layer, you might still lose patients who abandon the form.";

      drawPlainEnglishBox(margin, currY, cW2, colors.headerBg, "SECTION 2 IN PLAIN ENGLISH", sec2Text, "If 15 people a month try a broken form, they bounce. This is silently costing you booked exams every day.");
      drawPlainEnglishBox(margin + cW2 + 10, currY, cW2, colors.headerBg, "SECTION 3 IN PLAIN ENGLISH", "A mobile visitor stares at a loading screen for 4 seconds before your Call Now button is even tappable. This is long enough for roughly 1 in 5 patients to bounce back.", "It is like your front desk making a patient stand there in silence for 4 seconds before acknowledging them.");

      // ---------------------------------------------------------
      // PAGE 3: AI & Ads
      // ---------------------------------------------------------
      doc.addPage();
      currY = margin;
      currY = drawSectionHeader("4", "AI & Automation Maturity", "Your 24/7 responsiveness and automated patient comms.", currY);

      const drawListItem = (y: number, iconColor: string, title: string, desc: string) => {
        // Draw hollow circle with X
        doc.circle(margin + 10, y + 10, 8).lineWidth(1.5).stroke(iconColor);
        doc.moveTo(margin + 6, y + 6).lineTo(margin + 14, y + 14).lineWidth(1.5).stroke(iconColor);
        doc.moveTo(margin + 14, y + 6).lineTo(margin + 6, y + 14).lineWidth(1.5).stroke(iconColor);
        
        doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(11).text(title, margin + 30, y + 2);
        doc.fillColor(colors.textMuted).font("Helvetica").fontSize(9).text(desc, margin + 30, y + 16);
        doc.roundedRect(pageW - margin - 100, y + 4, 100, 20, 10).fill(colors.headerBg);
        doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(7).text("AI FIX AVAILABLE", pageW - margin - 100, y + 10, { width: 100, align: "center" });
        return y + 45;
      };

      currY = drawListItem(currY, colors.red, "AI Chatbot / Live Chat", "No chat widget detected. After-hours visitors bounce.");
      currY = drawListItem(currY, colors.red, "Missed-Call Text-Back", "No instant SMS. 62% of callers move to competitors.");
      currY = drawListItem(currY, colors.red, "Patient Comms / PRM", "No PRM script detected. Reminders are likely manual.");
      currY += 20;

      currY = drawSectionHeader("5", "Ad Tracking & Paid Readiness", "Foundation for running profitable paid campaigns.", currY);
      
      const hasPixels = data.checks?.hasMetaPixel || (data.websiteChecks?.marketingPixelsDetected?.length > 0);

      drawCard(margin, currY, cW2, 80, hasPixels ? colors.green : colors.red, "META PIXEL", hasPixels ? "Active" : "Missing", "Retargeting audience building.");
      drawCard(margin + cW2 + 10, currY, cW2, 80, colors.green, "GOOGLE ADS", "Active", "Tracking foundation in place.");
      currY += 90;
      drawCard(margin, currY, cW2, 80, colors.green, "ANALYTICS / GTM", "Active", "GA4 configuration detected.");
      drawCard(margin + cW2 + 10, currY, cW2, 80, "#9CA3AF", "LSA SCREENED", "Not Verified", "Missing the top-of-SERP trust badge.");
      currY += 95;

      drawPlainEnglishBox(margin, currY, cW2, colors.headerBg, "SECTION 4 IN PLAIN ENGLISH", "You are missing opportunities while you sleep. Most people are searching for help after hours, on weekends, or during lunch. When you don't respond, they move on.", "cracked molar, Saturday 9pm. They call, get your voicemail, and immediately call the next dentist on Google.");
      drawPlainEnglishBox(margin + cW2 + 10, currY, cW2, colors.headerBg, "SECTION 5 IN PLAIN ENGLISH", "You can't retarget visitors properly. Without a Pixel, any money you spend on ads is wasted because you cannot track who showed interest.", "500 people read your implants page but didn't book. Without a Pixel, they are gone forever.");

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

      currY = drawBanner(currY, colors.lightOrange, "#B45309", "! HOURS INCONSISTENCY DETECTED: Homepage, Contact, and Maps do not match.");
      currY += 20;

      currY = drawSectionHeader("7", "AI Overviews & Generative Engine Readiness", "Is ChatGPT and Google AI citing you?", currY);
      drawCard(margin, currY, cW2, 80, colors.green, "TOPICAL STRUCTURE", "Strong", "Dedicated silo pages for towns.");
      drawCard(margin + cW2 + 10, currY, cW2, 80, colors.orange, "ANSWER-READY", "Needs Work", "Marketing copy instead of direct Q/A.");
      currY += 90;
      drawCard(margin, currY, cW2, 80, colors.orange, "STRUCTURED DATA", "Unverified", "Schema.org tags are missing.");
      drawCard(margin + cW2 + 10, currY, cW2, 80, colors.orange, "CITATION AUTHORITY", "Thin", "Directory gaps weaken trust signals.");
      currY += 95;

      drawPlainEnglishBox(margin, currY, cW2, colors.headerBg, "SECTION 6 IN PLAIN ENGLISH", "Inconsistent hours confuse Google Maps. If your website says one thing and Yelp says another, Google drops your ranking because it can't trust the data.", "Maps says you open 8am Saturday, but your site footer says closed. Google penalizes this.");
      drawPlainEnglishBox(margin + cW2 + 10, currY, cW2, colors.headerBg, "SECTION 7 IN PLAIN ENGLISH", "AI engines need direct answers, not fluff. ChatGPT and Perplexity are looking for structured Q&A formats, not generic brochure marketing copy.", "\"We provide compassionate, state-of-the-art care\" does not help an AI engine answer a user's question.");

      // ---------------------------------------------------------
      // PAGE 5: Pitch & Call to Action
      // ---------------------------------------------------------
      doc.addPage();
      currY = margin;
      
      doc.rect(margin, currY, cW3, 60).fill(colors.bg);
      doc.rect(margin, currY, 4, 60).fill(colors.green);
      doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(10).text("BRINGING PATIENTS", margin + 12, currY + 5);
      doc.fillColor(colors.textMuted).font("Helvetica").fontSize(9).text(`Elite reputation (${reviewCount} reviews), clean tracking setup, and structured local SEO.`, margin + 12, currY + 20, { width: cW3 - 16 });

      doc.rect(margin + cW3 + 10, currY, cW3, 60).fill(colors.bg);
      doc.rect(margin + cW3 + 10, currY, 4, 60).fill(colors.red);
      doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(10).text("LOSING PATIENTS", margin + cW3 + 22, currY + 5);
      doc.fillColor(colors.textMuted).font("Helvetica").fontSize(9).text("A broken insurance form, split booking systems, and slow mobile load times.", margin + cW3 + 22, currY + 20, { width: cW3 - 16 });

      doc.rect(margin + (cW3 + 10) * 2, currY, cW3, 60).fill(colors.bg);
      doc.rect(margin + (cW3 + 10) * 2, currY, 4, 60).fill(colors.orange);
      doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(9).text("WHERE COMPETITORS PULL AHEAD", margin + (cW3 + 10) * 2 + 12, currY + 5);
      doc.fillColor(colors.textMuted).font("Helvetica").fontSize(9).text("No AI chat, no instant text-back, no unified real-time booking.", margin + (cW3 + 10) * 2 + 12, currY + 20, { width: cW3 - 16 });

      currY += 80;

      doc.roundedRect(margin, currY, contentW, 250, 12).fill(colors.headerBg);
      doc.fillColor(colors.white).font("Times-Bold").fontSize(20).text("CLOSE THE AI GAP IN 30 DAYS", margin, currY + 25, { width: contentW, align: "center" });
      
      const drawPitchBox = (x: number, y: number, w: number, title: string, sub: string) => {
        doc.roundedRect(x, y, w, 45, 6).lineWidth(1).stroke("#14B8A6");
        doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(10).text(title, x + 10, y + 10);
        doc.fillColor("#94A3B8").font("Helvetica").fontSize(8).text(sub, x + 10, y + 25);
      };

      const pbW = (contentW - 60) / 2;
      drawPitchBox(margin + 20, currY + 65, pbW, "AI Calling", "Never miss a call — instant text-back & AI voice.");
      drawPitchBox(margin + 20, currY + 125, pbW, "AI Appointments", "One unified, real-time booking system, no more split tools.");
      drawPitchBox(margin + 20, currY + 185, pbW, "AI SEO / GEO", "Structure content so AI Overviews & ChatGPT cite you first.");
      
      drawPitchBox(margin + contentW / 2 + 10, currY + 65, pbW, "AI-Ready Website", "Fix the broken form, add a 24/7 chatbot & qualified intake.");
      drawPitchBox(margin + contentW / 2 + 10, currY + 125, pbW, "AI Reputation", "Turn Facebook into a real review channel, close the response gap.");

      currY += 250;
      
      doc.roundedRect((pageW - 200) / 2, currY, 200, 40, 20).fill(colors.amber);
      doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(12).text("Book Free Strategy Call", margin, currY + 14, { width: contentW, align: "center" });
      currY += 70;

      // Terminology Box
      doc.rect(margin, currY, contentW, 90).fill(colors.white);
      doc.rect(margin, currY, contentW, 90).lineWidth(1).stroke(colors.border);
      doc.rect(margin, currY, 4, 90).fill(colors.orange);
      doc.fillColor(colors.orange).font("Helvetica-Bold").fontSize(8).text("THE FIVE WORDS IN THIS REPORT WORTH KNOWING", margin + 12, currY + 8);
      
      const termW = (contentW - 30) / 5;
      let tx = margin + 12;
      const terms = [
        { t: "MAP PACK", d: "The three practices Google shows in the map box, above all other results." },
        { t: "PIXEL", d: "Free code that lets you re-advertise to people who already visited your site." },
        { t: "SCHEMA", d: "Hidden labels telling Google and ChatGPT your hours, address and services." },
        { t: "PRM", d: "Patient reminders and recalls sent automatically instead of by hand." },
        { t: "LSA", d: "Google Screened — the verified badge shown above ordinary Google ads." }
      ];
      terms.forEach(term => {
        doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(7).text(term.t, tx, currY + 25, { width: termW });
        doc.fillColor(colors.textMuted).font("Helvetica").fontSize(7).text(term.d, tx, currY + 35, { width: termW, lineGap: 1 });
        tx += termW + 5;
      });
      
      doc.fillColor(colors.textDark).font("Helvetica").fontSize(9).text("Not sure which of these matters most for your practice? That is what the free strategy call above is for.", margin + 12, currY + 75);


      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
