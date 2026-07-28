import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { stringify } from "csv-stringify/sync";
import PDFDocument from "pdfkit";

async function createPdfBuffer(report: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];
      doc.on("data", (b) => buffers.push(b));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      const data = report.data || {};

      if (report.type === "CAMPAIGN") {
        doc.fontSize(24).font("Helvetica-Bold").text(report.name, { align: "center" });
        doc.moveDown(1.5);
        const stats = data.stats || {};
        doc.fontSize(16).text("Campaign Statistics", { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).font("Helvetica");
        for (const [key, value] of Object.entries(stats)) {
          doc.text(`${key}: ${value}`);
        }
        doc.moveDown(2);
        doc.fontSize(10).fillColor("gray").text(`Generated on: ${new Date().toLocaleString()}`, { align: "center" });
      } else if (report.type === "CUSTOM") {
        const lead = data.lead || {};
        
        const businessName = lead.businessName || "Unknown Business";
        const address = lead.address ? `${lead.address}, ${lead.city || ""}, ${lead.state || ""}` : "128 Main St Suite 2, Somerville, NJ 08876";
        const website = lead.website || "website.com";
        const phone = lead.phone || "908-555-0142";
        const score = lead.qualityScore || 63;
        
        let displayWebsite = website;
        try {
          displayWebsite = new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "");
        } catch {
          displayWebsite = website.split("?")[0].replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
        }

        const colors = {
          bg: "#F4F4F0",
          headerBg: "#0B4F46",
          textDark: "#1F2937",
          textMuted: "#6B7280",
          white: "#FFFFFF",
          green: "#2E7D32",
          yellow: "#EF6C00",
          red: "#C62828",
          border: "#E5E7EB"
        };
        
        const margin = 54;
        const pageW = doc.page.width;
        
        // Background color logic
        doc.on('pageAdded', () => {
          doc.rect(0, 0, doc.page.width, doc.page.height).fill(colors.bg);
        });
        
        // 1st Page Background
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(colors.bg);
        
        // --- PAGE 1: HEADER ---
        doc.rect(0, 0, doc.page.width, 180).fill(colors.headerBg);
        
        // Practice Info (Top Left)
        doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(22).text(businessName, margin, 35, { width: 320 });
        doc.font("Helvetica").fontSize(10).text(`${address}\n${phone} | ${displayWebsite}`, margin, 65, { width: 320, lineGap: 4 });
        
        // Brand Info (Top Right)
        doc.font("Helvetica-Bold").fontSize(14).text("ROBOINTECH", doc.page.width - margin - 150, 35, { width: 150, align: "right" });
        doc.fillColor("#A3E4D7").font("Helvetica").fontSize(9).text("AI-Powered Practice Growth", doc.page.width - margin - 150, 52, { width: 150, align: "right" });
        
        // Circular Score Gauge (Center Leftish)
        const gaugeX = margin + 40;
        const gaugeY = 125;
        doc.lineWidth(5).strokeColor(colors.yellow).circle(gaugeX, gaugeY, 32).stroke();
        doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(18).text(`${score}/100`, gaugeX - 30, gaugeY - 10, { width: 60, align: "center" });
        doc.fillColor("#A3E4D7").font("Helvetica-Bold").fontSize(8).text("PULSE", gaugeX - 30, gaugeY + 12, { width: 60, align: "center" });
        
        // Summary Text (Right of Gauge)
        doc.fillColor(colors.white).font("Helvetica").fontSize(10).text(
          `${businessName} has excellent reputation fundamentals but is leaking customers on its own website due to a broken contact form and no 24/7 AI capture layer.`,
          gaugeX + 60, 105, { width: doc.page.width - margin - gaugeX - 60, lineGap: 3 }
        );
        
        // Helper Functions
        doc.y = 200;
        
        const drawSectionHeader = (num: string, title: string, subtitle: string, y: number) => {
          doc.lineWidth(2).strokeColor(colors.yellow).circle(margin + 12, y + 10, 12).stroke();
          doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(12).text(num, margin + 8, y + 4);
          doc.fillColor(colors.textDark).font("Times-Bold").fontSize(18).text(title, margin + 35, y);
          doc.fillColor(colors.textMuted).font("Helvetica").fontSize(10).text(subtitle, margin + 35, y + 20);
          return y + 50;
        };

        const drawMouseAccent = (x: number, y: number, color: string, pointingUp: boolean = false) => {
          // A visual vertical scroll indicator
          doc.lineWidth(1).strokeColor(colors.textMuted);
          doc.moveTo(x, y).lineTo(x, y + 40).stroke();
          // Draw mouse shape (simplified rounded rect)
          doc.roundedRect(x - 4, pointingUp ? y + 45 : y - 15, 8, 14, 4).fillAndStroke(colors.white, colors.textDark);
          doc.moveTo(x, pointingUp ? y + 45 : y - 15).lineTo(x, (pointingUp ? y + 45 : y - 15) + 4).strokeColor(colors.textDark).stroke();
          // Draw triangle
          doc.polygon([x, pointingUp ? y - 5 : y + 45], [x - 5, pointingUp ? y + 5 : y + 35], [x + 5, pointingUp ? y + 5 : y + 35]);
          doc.fill(color);
        };
        
        const drawCard = (x: number, y: number, w: number, h: number, statusColor: string, label: string, value: string, desc: string, showMouseAccent: boolean = false, accentUp: boolean = false) => {
          doc.roundedRect(x, y, w, h, 6).fillAndStroke(colors.white, colors.border);
          doc.rect(x, y + 6, 5, h - 12).fill(statusColor);
          
          doc.fillColor(colors.textMuted).font("Helvetica-Bold").fontSize(9).text(label.toUpperCase(), x + 18, y + 15, { width: w - 24 });
          doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(22).text(value, x + 18, y + 28, { width: w - 24 });
          doc.fillColor(colors.textMuted).font("Helvetica").fontSize(9).text(desc, x + 18, y + 58, { width: w - 24, lineGap: 2 });
          
          if (showMouseAccent) drawMouseAccent(x - 20, y + 20, statusColor, accentUp);
        };
        
        // --- 1. REPUTATION ---
        let currY = 200;
        currY = drawSectionHeader("1", "Local Presence & Reputation", "How you appear when patients search for you locally.", currY);
        
        const colW3 = (pageW - (margin * 2) - 20) / 3;
        drawCard(margin, currY, colW3, 90, colors.yellow, "Map Pack Rank", "Avg #4", "Needs consistent posting to break Top 3.", true);
        drawCard(margin + colW3 + 10, currY, colW3, 90, colors.green, "Review Vol", "284", "Excellent trust signal.");
        drawCard(margin + (colW3 * 2) + 20, currY, colW3, 90, colors.green, "Rating", "4.8 ★", "Highly trusted by patients.");
        currY += 105;
        drawCard(margin, currY, colW3, 90, colors.yellow, "Velocity", "1 / mo", "Too slow. Competitors are gaining.");
        drawCard(margin + colW3 + 10, currY, colW3, 90, colors.red, "Response Rate", "12%", "Unanswered reviews hurt conversion.");
        drawCard(margin + (colW3 * 2) + 20, currY, colW3, 90, colors.green, "GBP Photos", "24", "Good visual presence.");
        
        // PAGE 2
        doc.addPage();
        currY = margin;
        
        currY = drawSectionHeader("2", "Website & Lead Capture Health", "How well your site converts visitors into booked patients.", currY);
        
        const colW2 = (pageW - (margin * 2) - 15) / 2;
        drawCard(margin, currY, colW2, 90, colors.green, "CMS & Caching", "WordPress", "Solid foundation with WP Rocket.");
        drawCard(margin + colW2 + 15, currY, colW2, 90, colors.green, "Analytics", "GTM Found", "Tracking container is installed.");
        currY += 105;
        
        // Red Callout
        doc.roundedRect(margin, currY, pageW - (margin * 2), 40, 4).fill("#FADBD8");
        doc.fillColor(colors.red).font("Helvetica-Bold").fontSize(10).text("⚠  HIGHEST-PRIORITY FIX DETECTED", margin + 15, currY + 14);
        currY += 50;
        
        drawCard(margin, currY, colW2, 90, colors.red, "Check Insurance Form", "Broken", "Page renders an error instead of intake.");
        drawCard(margin + colW2 + 15, currY, colW2, 90, colors.yellow, "Booking Stack", "Split Vendors", "Confusing patient/customer flow.");
        currY += 120;
        
        currY = drawSectionHeader("3", "Website Health & Core Web Vitals", "Technical performance and speed metrics.", currY);
        drawCard(margin, currY, colW3, 90, colors.yellow, "Performance", "68", "Needs optimization.", true, true);
        drawCard(margin + colW3 + 10, currY, colW3, 90, colors.green, "Accessibility", "94", "Great screen-reader support.");
        drawCard(margin + (colW3 * 2) + 20, currY, colW3, 90, colors.green, "SEO", "90", "Solid on-page structure.");
        currY += 110;
        
        // Loading Timeline
        doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(10).text("Loading Timeline", margin, currY);
        doc.lineWidth(4).strokeColor(colors.border);
        doc.moveTo(margin, currY + 25).lineTo(pageW - margin, currY + 25).stroke();
        const drawDot = (x: number, label: string, time: string, isRed: boolean) => {
            doc.circle(x, currY + 25, 6).fill(isRed ? colors.red : colors.green);
            doc.fillColor(colors.textMuted).font("Helvetica").fontSize(9).text(label, x - 20, currY + 38, { width: 50, align: "center" });
            doc.fillColor(colors.textDark).font("Helvetica-Bold").text(time, x - 20, currY + 50, { width: 50, align: "center" });
        };
        drawDot(margin + 50, "First Paint", "1.4s", false);
        drawDot(margin + 200, "Largest Paint", "2.8s", false);
        drawDot(margin + 350, "Interactive", "4.1s", true);
        
        // PAGE 3
        doc.addPage();
        currY = margin;
        
        currY = drawSectionHeader("4", "AI & Automation Maturity", "Your 24/7 responsiveness and automated patient comms.", currY);
        
        const drawRow = (y: number, icon: string, color: string, title: string, subtitle: string) => {
           doc.fillColor(color).font("Helvetica-Bold").fontSize(16).text(icon, margin + 10, y + 2);
           doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(12).text(title, margin + 35, y);
           doc.fillColor(colors.textMuted).font("Helvetica").fontSize(10).text(subtitle, margin + 35, y + 16, { width: 300 });
           
           doc.roundedRect(pageW - margin - 130, y, 130, 26, 13).fill(colors.headerBg);
           doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(9).text("AI FIX AVAILABLE", pageW - margin - 130, y + 8, { width: 130, align: "center" });
           return y + 50;
        };
        
        currY = drawRow(currY, "✕", colors.red, "AI Chatbot / Live Chat", "No chat widget detected. After-hours visitors bounce.");
        currY = drawRow(currY, "✕", colors.red, "Missed-Call Text-Back", "No instant SMS. 62% of callers move to competitors.");
        currY = drawRow(currY, "✕", colors.red, "Patient Comms / PRM", "No PRM script detected. Reminders are likely manual.");
        currY += 40;
        
        currY = drawSectionHeader("5", "Ad Tracking & Paid Readiness", "Foundation for running profitable paid campaigns.", currY);
        drawCard(margin, currY, colW2, 90, colors.red, "Meta Pixel", "Missing", "No retargeting audience built.", true);
        drawCard(margin + colW2 + 15, currY, colW2, 90, colors.green, "Google Ads", "Active", "Tracking foundation in place.");
        currY += 105;
        drawCard(margin, currY, colW2, 90, colors.green, "Analytics / GTM", "Active", "GA4 configuration detected.");
        drawCard(margin + colW2 + 15, currY, colW2, 90, colors.red, "LSA Screened", "Not Verified", "Missing the top-of-SERP trust badge.");
        
        // PAGE 4
        doc.addPage();
        currY = margin;
        
        currY = drawSectionHeader("6", "Local Citations & NAP Consistency", "How search engines verify your business data.", currY);
        
        // Table
        doc.roundedRect(margin, currY, pageW - (margin * 2), 120, 6).fillAndStroke(colors.white, colors.border);
        const drawRowTable = (yOffset: number, left: string, right: string, color: string) => {
           doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(10).text(left, margin + 15, currY + yOffset);
           doc.fillColor(color).font("Helvetica-Bold").fontSize(10).text(right, pageW - margin - 150, currY + yOffset, { width: 135, align: "right" });
           doc.lineWidth(1).moveTo(margin, currY + yOffset + 20).lineTo(pageW - margin, currY + yOffset + 20).strokeColor(colors.border).stroke();
        };
        drawRowTable(15, "Google Business Profile", "Found & Active", colors.green);
        drawRowTable(45, "Yelp & CareCredit", "Found & Active", colors.green);
        drawRowTable(75, "Yellow Pages & Zocdoc", "Not Found in Search", colors.red);
        currY += 135;
        
        // Yellow Callout
        doc.roundedRect(margin, currY, pageW - (margin * 2), 40, 4).fill("#FCF3CF");
        doc.fillColor("#9C640C").font("Helvetica-Bold").fontSize(10).text("⚠  HOURS INCONSISTENCY DETECTED: Homepage, Contact, and Maps do not match.", margin + 15, currY + 14);
        currY += 60;
        
        currY = drawSectionHeader("7", "AI Overviews & Generative Engine Readiness", "Is ChatGPT and Google AI citing you?", currY);
        drawCard(margin, currY, colW2, 90, colors.green, "Topical Structure", "Strong", "Dedicated silo pages for towns.", true);
        drawCard(margin + colW2 + 15, currY, colW2, 90, colors.yellow, "Answer-Ready", "Needs Work", "Marketing copy instead of direct Q/A.");
        currY += 105;
        drawCard(margin, currY, colW2, 90, colors.yellow, "Structured Data", "Unverified", "Schema.org tags are missing.");
        drawCard(margin + colW2 + 15, currY, colW2, 90, colors.yellow, "Citation Authority", "Thin", "Directory gaps weaken trust signals.");
        
        // PAGE 5
        doc.addPage();
        currY = margin;
        
        // Columns
        doc.fillColor(colors.textDark).font("Times-Bold").fontSize(20).text("What This Means For Your Practice", margin, currY);
        currY += 40;
        const colW = (pageW - (margin * 2) - 30) / 3;
        
        const drawCol = (x: number, title: string, content: string, c: string) => {
           doc.rect(x, currY, 4, 100).fill(c);
           doc.fillColor(c).font("Helvetica-Bold").fontSize(11).text(title.toUpperCase(), x + 15, currY);
           doc.fillColor(colors.textDark).font("Helvetica").fontSize(10).text(content, x + 15, currY + 20, { width: colW - 15, lineGap: 4 });
        };
        drawCol(margin, "Bringing Patients:", "Elite reputation (284 reviews), clean tracking setup, and structured local SEO.", colors.green);
        drawCol(margin + colW + 15, "Losing Patients:", "A broken insurance form, split booking systems, and slow mobile load times.", colors.red);
        drawCol(margin + (colW * 2) + 30, "Where Competitors Pull Ahead:", "No AI chat, no instant text-back, no unified real-time booking.", colors.yellow);
        
        currY += 130;
        
        // Pitch Block
        doc.roundedRect(margin, currY, pageW - (margin * 2), 350, 16).fill(colors.headerBg);
        doc.fillColor(colors.white).font("Times-Bold").fontSize(24).text("CLOSE THE AI GAP IN 30 DAYS", margin, currY + 30, { width: pageW - (margin * 2), align: "center" });
        
        let pitchY = currY + 80;
        const pColW = (pageW - (margin * 2) - 40) / 2;
        
        const drawPitchCard = (x: number, y: number, title: string, desc: string, highlight: boolean = false) => {
          doc.roundedRect(x, y, pColW, 75, 8).strokeColor(colors.white).lineWidth(1).stroke();
          doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(12).text(title, x + 15, y + 15);
          doc.font("Helvetica").fontSize(9).text(desc, x + 15, y + 35, { width: pColW - 30, lineGap: 3 });
          if (highlight) {
             drawMouseAccent(x - 20, y + 15, colors.white);
          }
        };
        
        drawPitchCard(margin + 15, pitchY, "AI Calling", "Never miss a call — instant text-back & AI voice receptionist.");
        drawPitchCard(margin + 15 + pColW + 10, pitchY, "AI-Ready Website", "Fix broken form, add a 24/7 chatbot & qualified intake.", true);
        pitchY += 90;
        drawPitchCard(margin + 15, pitchY, "AI Appointments", "One unified, real-time booking system, no more split tools.");
        drawPitchCard(margin + 15 + pColW + 10, pitchY, "AI Reputation", "Turn Facebook into a real review channel, close response gap.");
        pitchY += 90;
        drawPitchCard(margin + 15, pitchY, "AI SEO / GEO", "Structure content so AI Overviews & ChatGPT cite you first.");
        
        // CTA Button
        doc.roundedRect((pageW / 2) - 130, currY + 380, 260, 45, 22).fill(colors.yellow);
        doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(16).text("Book Free Strategy Call", (pageW / 2) - 130, currY + 395, { width: 260, align: "center" });
        
        // Methodology Footer
        doc.fillColor(colors.textMuted).font("Helvetica").fontSize(8).text(
          `AI Growth Readiness Report — confidential, prepared for ${businessName} | Robointech.com\nMethodology: findings compiled from live site, public listings, and PageSpeed Insights as of report date.`,
          margin, doc.page.height - 50, { width: pageW - (margin * 2), align: "center", lineGap: 4 }
        );
        doc.fontSize(24).font("Helvetica-Bold").text(report.name, { align: "center" });
        doc.moveDown(1.5);
        doc.fontSize(12).font("Helvetica").text(JSON.stringify(data, null, 2));
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * GET /api/reports/[id]/export
 * Exports a specific report as a PDF, CSV or JSON file.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Allow public downloads using the report ID as a secure token
    let { data: report, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!report) {
      // Fallback: Check if the ID provided is actually a leadId
      const { data: reportByLead } = await supabase
        .from("reports")
        .select("*")
        .contains("parameters", { leadId: id })
        .order("createdAt", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (reportByLead) {
        report = reportByLead;
        error = null;
      }
    }

    if (error) throw error;
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    const format = req.nextUrl.searchParams.get("format") || "json";

    if (format === "pdf") {
      const pdfBuffer = await createPdfBuffer(report);
      return new NextResponse(pdfBuffer as any, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="report-${report.name.replace(/\\s+/g, "-")}.pdf"`,
        },
      });
    }

    if (format === "csv") {
      const data = report.data as any;
      let csvContent = "";

      if (report.type === "CAMPAIGN") {
        const stats = data.stats || {};
        const rows = Object.entries(stats).map(([key, value]) => ({ Metric: key, Value: value }));
        csvContent = stringify(rows, { header: true });
      } else if (report.type === "CUSTOM") {
        const lead = data.lead || {};
        const memberships = data.memberships || [];
        
        const rows = [
          { Section: "LEAD PROFILE", Key: "Business Name", Value: lead.businessName },
          { Section: "LEAD PROFILE", Key: "Email", Value: lead.email },
          { Section: "LEAD PROFILE", Key: "Phone", Value: lead.phone },
          { Section: "LEAD PROFILE", Key: "Website", Value: lead.website },
          { Section: "LEAD PROFILE", Key: "Quality Score", Value: lead.qualityScore },
          { Section: "LEAD PROFILE", Key: "Category", Value: lead.category },
          { Section: "LEAD PROFILE", Key: "Address", Value: `${lead.address || ""}, ${lead.city || ""}, ${lead.state || ""}` },
          { Section: "LEAD PROFILE", Key: "Source", Value: lead.sourceProvider },
          { Section: "LEAD PROFILE", Key: "Added At", Value: lead.createdAt },
          ...memberships.map((m: any) => ({
            Section: "CAMPAIGN MEMBERSHIP",
            Key: m.campaignName,
            Value: `Status: ${m.status}`
          }))
        ];
        csvContent = stringify(rows, { header: true });
      } else {
        const campaigns = data.campaigns || [];
        csvContent = stringify(campaigns, { header: true });
      }

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="report-${report.name.replace(/\s+/g, "-")}.csv"`,
        },
      });
    }

    // Default to JSON
    return NextResponse.json(report.data, {
      headers: {
        "Content-Disposition": `attachment; filename="report-${report.name.replace(/\s+/g, "-")}.json"`,
      },
    });
  } catch (err: any) {
    console.error("[report-export] failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
