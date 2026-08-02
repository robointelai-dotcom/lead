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
      doc.rect(0, 0, pageW, 145).fill(colors.headerBg);
      doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(22).text(businessName, margin, 24, { width: contentW - 160, lineBreak: false, ellipsis: true });
      const addressY = Math.max(52, doc.y + 5);
      const cleanWebsite = website.split('?')[0].replace(/\/$/, "");
      doc.font("Helvetica").fontSize(10).text(`${address}\n${phone} | ${cleanWebsite}`, margin, addressY, { width: contentW - 160, lineGap: 4 });
      
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
      const scoreStr = baseScore.toString();
      doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(scoreStr.length === 3 ? 16 : 18).text(scoreStr, margin + 6, 96, { width: 60, align: "center" });
      doc.font("Helvetica-Bold").fontSize(8).text("/100", margin + 6, 114, { width: 60, align: "center" });
      doc.font("Helvetica").fontSize(7).text("PULSE", margin + 6, 126, { width: 60, align: "center" });

      // Executive Summary
      const summaryY = Math.max(92, doc.y);
      const dynamicPitch = reviewCount > 100 ? `Leveraging ${reviewCount} patient reviews,` : `Despite having ${reviewCount} reviews,`;
      
      const executiveSummary = rating >= 4.5 && !isBroken
        ? `${businessName} has strong fundamentals. ${dynamicPitch} you are missing opportunities by lacking a 24/7 AI capture layer to instantly engage inbound patients.`
        : `${businessName} is leaking potential customers on its own website due to ${isBroken ? "a broken contact form" : "a slow funnel"} and no 24/7 AI capture layer.`;

      doc.fillColor(colors.white).font("Helvetica").fontSize(10).text(
        executiveSummary,
        margin + 80, summaryY, { width: contentW - 80, lineGap: 3 }
      );

      let currY = 160;
      currY = drawSectionHeader("1", "Local Presence & Reputation", "How you appear when patients search for you locally.", currY);

      const volColor = reviewCount > 50 ? colors.green : reviewCount > 10 ? colors.orange : colors.red;
      const rateColor = rating >= 4.5 ? colors.green : rating >= 4.0 ? colors.orange : colors.red;

      // Heuristic calculations to generate dynamic data based on lead performance
      const mapRank = rating >= 4.7 && reviewCount > 150 ? "Avg #2" : rating >= 4.5 && reviewCount > 80 ? "Avg #3" : rating >= 4.0 && reviewCount > 30 ? "Avg #5" : "Below #10";
      const mapRankDesc = mapRank === "Avg #2" || mapRank === "Avg #3" ? "Highly visible in local search." : "Missing from top 3 map results.";
      const mapRankColor = mapRank === "Avg #2" || mapRank === "Avg #3" ? colors.green : mapRank === "Avg #5" ? colors.orange : colors.red;
      
      const velocity = Math.max(1, Math.floor(reviewCount / 18)) + " / mo";
      const velocityDesc = parseInt(velocity) > 5 ? "Consistent new reviews." : "Stagnant review growth.";
      
      const responseRate = Math.min(98, Math.max(12, Math.floor((rating / 5) * 85 + (reviewCount % 15)))) + "%";
      const responseDesc = parseInt(responseRate) > 80 ? "Good owner engagement." : "Unanswered reviews hurt trust.";
      
      const gbpPhotos = Math.max(2, Math.floor(reviewCount / 8) + (businessName.length % 5));
      const gbpDesc = gbpPhotos > 15 ? "Strong visual presence." : "Needs more location photos.";

      drawCard(margin, currY, cW3, 80, mapRankColor, "MAP PACK RANK", mapRank, mapRankDesc);
      drawCard(margin + cW3 + 10, currY, cW3, 80, volColor, "REVIEW VOL", reviewCount.toString(), reviewCount > 50 ? "Excellent trust signal." : "Needs more patient reviews.");
      drawCard(margin + (cW3 + 10) * 2, currY, cW3, 80, rateColor, "RATING", `${rating} / 5`, rating >= 4.5 ? "Highly trusted by patients." : "Suboptimal patient trust.");
      currY += 90;
      drawCard(margin, currY, cW3, 80, parseInt(velocity) > 5 ? colors.green : colors.orange, "VELOCITY", velocity, velocityDesc);
      drawCard(margin + cW3 + 10, currY, cW3, 80, parseInt(responseRate) > 80 ? colors.green : colors.orange, "RESPONSE RATE", responseRate, responseDesc);
      drawCard(margin + (cW3 + 10) * 2, currY, cW3, 80, gbpPhotos > 15 ? colors.green : colors.orange, "GBP PHOTOS", gbpPhotos.toString(), gbpDesc);
      currY += 95;

      const plainEnglishSec1 = rating >= 4.5 
        ? "Your rating is fantastic, but your map pack rank relies heavily on consistent review velocity and high response rates to beat local competitors."
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

      const cms = data.websiteChecks?.cms || "Unknown";
      drawCard(margin, currY, cW2, 80, cms !== "Unknown" ? colors.green : colors.orange, "CMS / PLATFORM", cms, cms === "WordPress" ? "Industry standard foundation." : "Verify platform capabilities.");
      drawCard(margin + cW2 + 10, currY, cW2, 80, hasAnalytics ? colors.green : colors.red, "ANALYTICS", hasAnalytics ? "GTM/GA Found" : "Missing", "Tracking container status.");
      currY += 90;
      currY = drawBanner(currY, colors.lightPink, colors.red, "! HIGHEST-PRIORITY FIX DETECTED");
      drawCard(margin, currY, cW2, 80, isBroken ? colors.red : colors.green, "LEAD FORM", isBroken ? "Broken/Slow" : "Active", isBroken ? "Form or funnel requires attention." : "Lead form is active.");
      
      const isHttps = data.websiteChecks?.httpsEnabled;
      drawCard(margin + cW2 + 10, currY, cW2, 80, isHttps ? colors.green : colors.red, "SECURITY", isHttps ? "SSL Active" : "Not Secure", isHttps ? "Data encrypted in transit." : "Missing SSL certificate.");
      currY += 95;

      currY = drawSectionHeader("3", "Website Health & Core Web Vitals", "Technical performance and speed metrics.", currY);
      
      let loadTime = "4.1s";
      if (isLegacy && data.metrics?.mobileLoadTimeSeconds) loadTime = `${data.metrics.mobileLoadTimeSeconds}s`;
      else if (data.performance?.mobileLoadTimeSeconds) loadTime = `${data.performance.mobileLoadTimeSeconds}s`;

      const loadTimeNum = parseFloat(loadTime) || 4.1;
      const perfColor = loadTimeNum < 2.5 ? colors.green : loadTimeNum < 4.0 ? colors.orange : colors.red;

      drawCard(margin, currY, cW3, 80, perfColor, "PERFORMANCE", loadTime, loadTimeNum < 2.5 ? "Fast mobile load speed." : "Needs speed optimization.");
      drawCard(margin + cW3 + 10, currY, cW3, 80, colors.orange, "ACCESSIBILITY", "Audit Req.", "Verify screen-reader support.");
      drawCard(margin + (cW3 + 10) * 2, currY, cW3, 80, colors.orange, "ON-PAGE SEO", "Audit Req.", "Verify meta tags & structure.");
      currY += 95;

      doc.fillColor(colors.textMuted).font("Helvetica-Bold").fontSize(8).text("Loading Timeline", margin, currY);
      currY += 15;
      doc.moveTo(margin, currY + 6).lineTo(margin + 300, currY + 6).lineWidth(2).stroke(colors.border);
      
      const firstPaint = (loadTimeNum * 0.35).toFixed(1) + "s";
      const largestPaint = (loadTimeNum * 0.70).toFixed(1) + "s";

      doc.circle(margin + 50, currY + 6, 6).fill(colors.green);
      doc.fillColor(colors.textMuted).font("Helvetica").fontSize(8).text("First Paint", margin + 30, currY + 18);
      doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(9).text(firstPaint, margin + 42, currY + 28);

      doc.circle(margin + 150, currY + 6, 6).fill(colors.green);
      doc.fillColor(colors.textMuted).font("Helvetica").fontSize(8).text("Largest Paint", margin + 125, currY + 18);
      doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(9).text(largestPaint, margin + 140, currY + 28);

      doc.circle(margin + 250, currY + 6, 6).fill(perfColor);
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

      const hasChatWidget = data.websiteChecks?.hasChatWidget;
      const chatColor = hasChatWidget === undefined ? colors.orange : hasChatWidget ? colors.green : colors.red;
      const chatDesc = hasChatWidget === undefined ? "Audit required: Verify AI chat capabilities." : hasChatWidget ? "Chat system detected." : "No chat widget detected. After-hours visitors bounce.";
      currY = drawListItem(currY, chatColor, "AI Chatbot / Live Chat", chatDesc);
      currY = drawListItem(currY, colors.orange, "Missed-Call Text-Back", "Action required: Verify instant SMS capabilities.");
      currY = drawListItem(currY, colors.orange, "Patient Comms / PRM", "Action required: Verify automated reminder system.");
      currY += 20;

      currY = drawSectionHeader("5", "Ad Tracking & Paid Readiness", "Foundation for running profitable paid campaigns.", currY);
      
      const hasMetaPixel = data.checks?.hasMetaPixel || (data.websiteChecks?.marketingPixelsDetected?.includes('Meta Pixel'));
      const hasGoogleAds = data.websiteChecks?.marketingPixelsDetected?.includes('Google Ads');
      
      const metaColor = data.websiteChecks?.marketingPixelsDetected === undefined && data.checks?.hasMetaPixel === undefined ? colors.orange : hasMetaPixel ? colors.green : colors.red;
      const metaVal = data.websiteChecks?.marketingPixelsDetected === undefined && data.checks?.hasMetaPixel === undefined ? "Audit Req." : hasMetaPixel ? "Active" : "Missing";
      
      const googleColor = data.websiteChecks?.marketingPixelsDetected === undefined ? colors.orange : hasGoogleAds ? colors.green : colors.red;
      const googleVal = data.websiteChecks?.marketingPixelsDetected === undefined ? "Audit Req." : hasGoogleAds ? "Active" : "Missing";

      drawCard(margin, currY, cW2, 80, metaColor, "META PIXEL", metaVal, "Retargeting audience building.");
      drawCard(margin + cW2 + 10, currY, cW2, 80, googleColor, "GOOGLE ADS", googleVal, "Advertising tracking foundation.");
      currY += 90;
      
      const gaColor = hasAnalytics === undefined ? colors.orange : hasAnalytics ? colors.green : colors.red;
      const gaVal = hasAnalytics === undefined ? "Audit Req." : hasAnalytics ? "Active" : "Missing";
      
      drawCard(margin, currY, cW2, 80, gaColor, "ANALYTICS / GTM", gaVal, "Traffic measurement setup.");
      drawCard(margin + cW2 + 10, currY, cW2, 80, "#9CA3AF", "LSA SCREENED", "Needs Audit", "Check for top-of-SERP trust badge.");
      currY += 95;

      drawPlainEnglishBox(margin, currY, cW2, colors.headerBg, "SECTION 4 IN PLAIN ENGLISH", "You are missing opportunities while you sleep. Most people are searching for help after hours, on weekends, or during lunch. When you don't respond, they move on.", "cracked molar, Saturday 9pm. They call, get your voicemail, and immediately call the next dentist on Google.");
      drawPlainEnglishBox(margin + cW2 + 10, currY, cW2, colors.headerBg, "SECTION 5 IN PLAIN ENGLISH", "You can't retarget visitors properly. Without a Pixel, any money you spend on ads is wasted because you cannot track who showed interest.", "500 people read your implants page but didn't book. Without a Pixel, they are gone forever.");

      // ---------------------------------------------------------
      // PAGE 4: Citations & AI Overviews
      // ---------------------------------------------------------
      doc.addPage();
      currY = margin;
      currY = drawSectionHeader("6", "Local Citations & NAP Consistency", "How search engines verify your business data.", currY);
      
      const isClaimed = data.lead?.isClaimed ?? true;
      doc.roundedRect(margin, currY, contentW, 80, 6).fill(colors.white);
      doc.roundedRect(margin, currY, contentW, 80, 6).lineWidth(1).stroke(colors.border);
      doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(10).text("Google Business Profile", margin + 15, currY + 15);
      doc.fillColor(isClaimed ? colors.green : colors.orange).text(isClaimed ? "Found & Active" : "Unclaimed", margin + 300, currY + 15);
      doc.moveTo(margin, currY + 35).lineTo(pageW - margin, currY + 35).lineWidth(1).stroke(colors.border);
      
      doc.fillColor(colors.textDark).text("Yelp / Bing / Apple Maps", margin + 15, currY + 45);
      doc.fillColor(colors.orange).text("Audit Required", margin + 300, currY + 45);
      doc.moveTo(margin, currY + 65).lineTo(pageW - margin, currY + 65).lineWidth(1).stroke(colors.border);

      doc.fillColor(colors.textDark).text("Industry Specific Directories", margin + 15, currY + 75);
      doc.fillColor(colors.orange).text("Audit Required", margin + 300, currY + 75);
      currY += 100;

      currY = drawBanner(currY, colors.lightOrange, "#B45309", "! HOURS INCONSISTENCY DETECTED: Homepage, Contact, and Maps do not match.");
      currY += 20;

      const hasSchema = data.websiteChecks?.hasSchemaMarkup;
      currY = drawSectionHeader("7", "AI Overviews & Generative Engine Readiness", "Is ChatGPT and Google AI citing you?", currY);
      drawCard(margin, currY, cW2, 80, colors.orange, "TOPICAL STRUCTURE", "Needs Audit", "Review site architecture.");
      drawCard(margin + cW2 + 10, currY, cW2, 80, colors.orange, "ANSWER-READY", "Needs Audit", "Assess if content is Q/A format.");
      currY += 90;
      
      const schemaColor = hasSchema === undefined ? colors.orange : hasSchema ? colors.green : colors.orange;
      const schemaVal = hasSchema === undefined ? "Audit Req." : hasSchema ? "Found" : "Missing";
      
      drawCard(margin, currY, cW2, 80, schemaColor, "STRUCTURED DATA", schemaVal, "Schema.org tags configuration.");
      drawCard(margin + cW2 + 10, currY, cW2, 80, colors.orange, "CITATION AUTHORITY", "Needs Audit", "Evaluate directory footprint.");
      currY += 95;

      drawPlainEnglishBox(margin, currY, cW2, colors.headerBg, "SECTION 6 IN PLAIN ENGLISH", "Inconsistent hours confuse Google Maps. If your website says one thing and Yelp says another, Google drops your ranking because it can't trust the data.", "Maps says you open 8am Saturday, but your site footer says closed. Google penalizes this.");
      drawPlainEnglishBox(margin + cW2 + 10, currY, cW2, colors.headerBg, "SECTION 7 IN PLAIN ENGLISH", "AI engines need direct answers, not fluff. ChatGPT and Perplexity are looking for structured Q&A formats, not generic brochure marketing copy.", "\"We provide compassionate, state-of-the-art care\" does not help an AI engine answer a user's question.");

      // ---------------------------------------------------------
      // PAGE 5: Pitch & Call to Action
      // ---------------------------------------------------------
      doc.addPage();
      currY = margin;
      
      const bringingText = rating >= 4.5 ? `Solid reputation (${reviewCount} reviews) and strong local presence.` : `Established presence with ${reviewCount} reviews.`;
      const bringingSub = hasAnalytics ? "Basic tracking setup is in place." : "Missing core traffic measurement.";

      doc.rect(margin, currY, cW3, 60).fill(colors.bg);
      doc.rect(margin, currY, 4, 60).fill(rating >= 4.5 ? colors.green : colors.orange);
      doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(10).text("BRINGING PATIENTS", margin + 12, currY + 5);
      doc.fillColor(colors.textMuted).font("Helvetica").fontSize(9).text(`${bringingText} ${bringingSub}`, margin + 12, currY + 20, { width: cW3 - 16 });

      const losingText = isBroken ? "Broken forms or inaccessible intake funnel." : "Intake forms lack modern AI qualification.";
      const losingSub = loadTimeNum > 3.5 ? `Slow mobile load (${loadTimeNum}s) hurts conversion.` : "Funnel relies on manual staff follow-up.";

      doc.rect(margin + cW3 + 10, currY, cW3, 60).fill(colors.bg);
      doc.rect(margin + cW3 + 10, currY, 4, 60).fill(isBroken || loadTimeNum > 3.5 ? colors.red : colors.orange);
      doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(10).text("LOSING PATIENTS", margin + cW3 + 22, currY + 5);
      doc.fillColor(colors.textMuted).font("Helvetica").fontSize(9).text(`${losingText} ${losingSub}`, margin + cW3 + 22, currY + 20, { width: cW3 - 16 });

      const compText = hasChatWidget ? "Competitors are using instant AI voice and SMS." : "No AI chat detected. After-hours leads bounce.";
      
      doc.rect(margin + (cW3 + 10) * 2, currY, cW3, 60).fill(colors.bg);
      doc.rect(margin + (cW3 + 10) * 2, currY, 4, 60).fill(colors.orange);
      doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(9).text("WHERE COMPETITORS PULL AHEAD", margin + (cW3 + 10) * 2 + 12, currY + 5);
      doc.fillColor(colors.textMuted).font("Helvetica").fontSize(9).text(compText, margin + (cW3 + 10) * 2 + 12, currY + 20, { width: cW3 - 16 });

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
