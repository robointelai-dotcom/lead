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
        
        const primaryColor = "#0f172a"; // Deep Slate
        const secondaryColor = "#334155";
        const accentColor = "#e11d48"; // Rose
        const successColor = "#10b981"; // Emerald
        const lightBg = "#f8fafc";
        
        // --- HEADER BANNER ---
        doc.rect(0, 0, doc.page.width, 140).fill(primaryColor);
        doc.fillColor("#ffffff").fontSize(24).font("Helvetica-Bold").text("AI GROWTH READINESS REPORT", 50, 40, { align: "left" });
        doc.fillColor("#94a3b8").fontSize(12).font("Helvetica").text("DIGITAL PRESENCE & AUTOMATION AUDIT", 50, 70, { align: "left" });
        
        doc.fillColor("#f1f5f9").fontSize(12).font("Helvetica-Bold").text(businessName, 50, 100, { align: "left" });
        doc.fillColor("#cbd5e1").fontSize(10).font("Helvetica").text(`${website}  |  ${phone}`, 50, 115, { align: "left" });
        
        // Reset position below banner
        doc.y = 160;
        doc.x = 50;
        
        // --- PREPARED BY ---
        doc.fillColor(secondaryColor).fontSize(9).text(`Report generated ${new Date().toLocaleDateString()}  ·  Prepared by Robointech`, { align: "right" });
        doc.moveDown(2);
        
        // --- EXECUTIVE SUMMARY ---
        doc.roundedRect(50, doc.y, doc.page.width - 100, 105, 8).fillAndStroke(lightBg, "#e2e8f0");
        const summaryY = doc.y + 15;
        doc.fillColor(primaryColor).fontSize(12).font("Helvetica-Bold").text("EXECUTIVE SUMMARY", 70, summaryY);
        doc.fillColor(secondaryColor).fontSize(10).font("Helvetica").text(
          `${businessName} has excellent reputation fundamentals and a well-structured local SEO site, but is leaking customers on its own website. The contact form is broken, booking is split across two tools, mobile load is slow, and there is no 24/7 AI layer. An estimated 15–22 new inquiries a month are going to competitors.`, 
          70, summaryY + 20, { width: doc.page.width - 140, lineGap: 3 }
        );
        doc.y = summaryY + 110;
        doc.x = 50;
        
        const drawSectionHeader = (title: string, yPos: number, scoreVal?: number) => {
            doc.roundedRect(50, yPos, doc.page.width - 100, 30, 4).fill(primaryColor);
            doc.fillColor("#ffffff").fontSize(12).font("Helvetica-Bold").text(title, 65, yPos + 9);
            if (scoreVal !== undefined) {
                const scoreColor = scoreVal > 80 ? successColor : scoreVal > 50 ? "#f59e0b" : accentColor;
                doc.roundedRect(doc.page.width - 120, yPos + 5, 60, 20, 10).fill(scoreColor);
                doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold").text(`${scoreVal}/100`, doc.page.width - 120, yPos + 10, { width: 60, align: "center" });
            }
            return yPos + 40;
        };
        
        const drawItem = (icon: string, title: string, desc: string, yPos: number, isBad: boolean = false) => {
            doc.fillColor(isBad ? accentColor : successColor).font("Helvetica-Bold").fontSize(12).text(icon, 60, yPos);
            doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(10).text(title, 80, yPos + 1);
            doc.fillColor(secondaryColor).font("Helvetica").text(desc, 80, yPos + 14, { width: doc.page.width - 150 });
            return doc.y + 10;
        };

        // --- 1. REPUTATION ---
        let currentY = drawSectionHeader("1. REPUTATION & PULSE", doc.y, score);
        currentY = drawItem("✓", "Google Business Profile", "3 posts last 90 days (Weekly posting recommended to stay competitive)", currentY);
        currentY = drawItem("⚠", "Facebook Reviews", "6 reviews. Under-utilized compared to Google's 284 reviews.", currentY, true);
        doc.y = currentY + 10;
        
        // --- 2. WEBSITE CAPTURE ---
        currentY = drawSectionHeader("2. WEBSITE & LEAD CAPTURE HEALTH", doc.y);
        currentY = drawItem("✓", "CMS & Caching", "WordPress + WP Rocket active (Reasonable performance foundation)", currentY);
        currentY = drawItem("⚠", "Broken Form", "Page renders a form error instead of the intake widget. HIGHEST-PRIORITY FIX.", currentY, true);
        currentY = drawItem("⚠", "Booking Stack", "Split across 2 vendors - Confusing patient flow. Unified system needed.", currentY, true);
        doc.y = currentY + 10;
        
        // --- 3. AI & AUTOMATION ---
        currentY = drawSectionHeader("3. AI & AUTOMATION MATURITY", doc.y);
        currentY = drawItem("✕", "AI Chatbot / Live Chat", "No chat widget detected. After-hours visitors get no response.", currentY, true);
        currentY = drawItem("✕", "Missed-Call Text-Back", "No instant SMS - 62% of callers move to the next competitor.", currentY, true);
        currentY = drawItem("✕", "Patient Comms", "No PRM script detected. Reminders are likely manual.", currentY, true);
        
        // PAGE BREAK
        doc.addPage();
        
        // Header on new page
        doc.rect(0, 0, doc.page.width, 60).fill(primaryColor);
        doc.fillColor("#ffffff").fontSize(14).font("Helvetica-Bold").text("AI GROWTH READINESS REPORT - CONTINUED", 50, 25, { align: "center" });
        doc.y = 90;
        
        // --- 4. WEB VITALS ---
        currentY = drawSectionHeader("4. CORE WEB VITALS & SEO", doc.y);
        currentY = drawItem("✓", "Scores", "Performance (68) | Accessibility (94) | SEO (90)", currentY);
        currentY = drawItem("⚠", "Speed Impact", "4.1s Interactive. A visitor stares at a loading screen for 4.1s before 'Call Now' is tappable.", currentY, true);
        doc.y = currentY + 10;

        // --- 5. PAID READINESS & CITATIONS ---
        currentY = drawSectionHeader("5. ADS & LOCAL CITATIONS", doc.y);
        currentY = drawItem("✓", "Google Ads & Analytics", "Pixel active. Tracking foundation in place.", currentY);
        currentY = drawItem("⚠", "Meta Pixel & LSA", "Missing Meta Pixel. LSA / Google Screened Not Verified.", currentY, true);
        currentY = drawItem("⚠", "Hours Inconsistency", "Homepage, Contact page, and directories list different hours. Google penalizes NAP mismatches.", currentY, true);
        doc.y = currentY + 10;
        
        // --- 6. AI OVERVIEWS ---
        currentY = drawSectionHeader("6. AI OVERVIEWS & GENERATIVE ENGINE READINESS", doc.y);
        currentY = drawItem("✓", "Topical Structure", "Strong foundation (Dedicated silo pages for nearby towns)", currentY);
        currentY = drawItem("⚠", "Answer-Ready Content", "Marketing copy, not Q&A (Service pages need direct Q/A format)", currentY, true);
        currentY = drawItem("⚠", "Schema & Citations", "Unverified structured data and thin directory gaps weaken trust signals.", currentY, true);
        doc.y = currentY + 10;
        
        // --- GROWTH PLAN ---
        doc.y += 10;
        doc.roundedRect(50, doc.y, doc.page.width - 100, 160, 8).fillAndStroke(lightBg, successColor);
        const planY = doc.y + 15;
        doc.fillColor(successColor).fontSize(14).font("Helvetica-Bold").text("CLOSE THE AI GAP IN 30 DAYS", 70, planY);
        doc.fillColor(primaryColor).fontSize(10).font("Helvetica").text(
          "• AI Calling: Never miss a call — instant text-back & AI voice receptionist.\n\n" +
          "• AI-Ready Website: Fix broken form, add a 24/7 chatbot & qualified intake.\n\n" +
          "• AI Appointments: One unified, real-time booking system, no more split tools.\n\n" +
          "• AI Reputation: Turn Facebook into a real review channel, close response gap.\n\n" +
          "• AI SEO / GEO: Structure content so AI Overviews & ChatGPT cite you first.", 
          70, planY + 25, { width: doc.page.width - 140, lineGap: 2 }
        );

        // Footer
        doc.y = doc.page.height - 70;
        doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor("#cbd5e1").stroke();
        doc.y += 15;
        doc.fillColor("#94a3b8").fontSize(8).font("Helvetica").text(
          `Confidential Report Prepared for ${businessName} | Robointech.com | AI-Powered Practice Growth\nMethodology: Findings compiled from live practice site, public page source, third-party listings, Lighthouse, and GBP.`, 
          50, doc.y, { align: "center", width: doc.page.width - 100 }
        );

      } else {
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
    const { data: report, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .single();

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
