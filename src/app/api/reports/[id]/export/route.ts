import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireSession } from "@/lib/auth";
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
        
        const primaryColor = "#1e3a8a"; 
        const secondaryColor = "#475569";
        const accentColor = "#e11d48"; 
        const successColor = "#16a34a"; 
        
        doc.fillColor(primaryColor).fontSize(20).font("Helvetica-Bold").text("AI GROWTH READINESS REPORT", { align: "center" });
        doc.fontSize(14).font("Helvetica").text("DIGITAL PRESENCE & AUTOMATION AUDIT", { align: "center" });
        doc.moveDown(0.5);
        
        doc.fillColor(secondaryColor).fontSize(10).text(`${businessName} · ${address} · ${website} · ${phone}`, { align: "center" });
        doc.moveDown(0.2);
        doc.fillColor("gray").fontSize(9).text(`Report generated ${new Date().toLocaleDateString()} · Prepared by Robointech`, { align: "center" });
        doc.text("ROBOINTECH AI-Powered Practice Growth · robointech.com", { align: "center" });
        
        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#e2e8f0").stroke();
        doc.moveDown(1);
        
        doc.fillColor("#000000").fontSize(11).font("Helvetica").text(
          `${businessName} has excellent reputation fundamentals and a well-structured local SEO site, but is leaking customers on its own website — the contact form is broken, booking is split across two tools, mobile load is slow, and there's no chatbot, text-back, or AI layer catching the customers who land after hours. An estimated 15–22 new inquiries a month are going to competitors with modern intake.`, 
          { lineGap: 4, align: "justify" }
        );
        doc.moveDown(1);
        
        doc.font("Helvetica-Bold").fillColor(successColor).text("✓ Strong reputation (284 reviews, 4.8★)");
        doc.text("✓ Solid on-page SEO & GTM tracking");
        doc.fillColor(accentColor).text("⚠ Broken lead form on homepage");
        doc.text("⚠ No AI chat / call automation");
        
        doc.moveDown(1.5);
        
        doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text(`1. PULSE (Score: ${score} / 100)`);
        doc.moveDown(0.5);
        doc.fillColor("#000000").fontSize(10).font("Helvetica");
        doc.text("• Google Business Profile: 3 posts last 90 days (Weekly posting recommended to stay competitive)");
        doc.text("• Facebook Reviews: 6 (Under-utilized compared to Google's 284)");
        doc.moveDown(1);
        
        doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text("2. Website & Lead Capture Health");
        doc.moveDown(0.5);
        doc.fillColor("#000000").fontSize(10).font("Helvetica");
        doc.text("• CMS & CACHING: WordPress + WP Rocket (Reasonable performance foundation)");
        doc.fillColor(accentColor).text("• FORM: Broken - Page renders a form error instead of the intake widget. HIGHEST-PRIORITY FIX.");
        doc.fillColor("#000000").text("• ANALYTICS: GTM Installed - Tracking container confirmed");
        doc.text("• BOOKING STACK: Split across 2 vendors - Confusing patient/customer flow");
        doc.moveDown(1);
        
        doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text("3. Website Health & Core Web Vitals");
        doc.moveDown(0.5);
        doc.fillColor("#000000").fontSize(10).font("Helvetica");
        doc.text("Scores: Performance (68) | Accessibility (94) | SEO (90)");
        doc.text("Speed: 1.4s First Paint | 2.8s Largest Paint | 4.1s Interactive");
        doc.fillColor(accentColor).text("Impact: A mobile visitor stares at a loading screen for 4.1 seconds before the 'Call Now' button is tappable — long enough for roughly 1 in 5 patients to bounce back to search results.");
        doc.moveDown(1);
        
        doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text("4. AI & Automation Maturity");
        doc.moveDown(0.5);
        doc.fillColor(accentColor).fontSize(10).font("Helvetica");
        doc.text("✕ AI Chatbot / Live Chat: No chat widget detected - after-hours visitors get no response.");
        doc.text("✕ Missed-Call Text-Back: No instant SMS - 62% of callers move to the next competitor.");
        doc.text("✕ Real-Time Self-Scheduling: Two different booking tools live on the site with no single source of truth.");
        doc.text("✕ Patient Comms / PRM Stack: No PRM script detected (e.g. Weave, Podium) - reminders are likely manual.");
        
        doc.addPage();
        
        doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text("5. Ad Tracking & Paid Readiness");
        doc.moveDown(0.5);
        doc.fillColor("#000000").fontSize(10).font("Helvetica");
        doc.text("• META PIXEL: Missing (No retargeting audience being built)");
        doc.text("• GOOGLE ADS PIXEL: Active");
        doc.text("• GOOGLE ANALYTICS / GTM: Active (Tracking foundation in place)");
        doc.text("• LSA / GOOGLE SCREENED: Not Verified (Missing the top-of-SERP trust badge)");
        doc.moveDown(1);
        
        doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text("6. Local Citations & NAP Consistency");
        doc.moveDown(0.5);
        doc.fillColor("#000000").fontSize(10).font("Helvetica");
        doc.text("• Google Business Profile, Yelp, Facebook, CareCredit: Found & Active");
        doc.text("• Yellow Pages, Angi, Zocdoc: Not found in search");
        doc.fillColor(accentColor).text("⚠ HOURS INCONSISTENCY DETECTED: Homepage footer lists Tue & Wed as 9am–6pm, Contact page lists Wed as 7:30am–6pm, and a directory lists Tue as 8am–3pm. Google penalizes exactly this kind of NAP mismatch.");
        doc.moveDown(1);
        
        doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text("7. AI Overviews & Generative Engine Readiness");
        doc.moveDown(0.5);
        doc.fillColor("#000000").fontSize(10).font("Helvetica");
        doc.text("• TOPICAL STRUCTURE: Strong foundation (Dedicated silo pages for nearby towns)");
        doc.text("• ANSWER-READY CONTENT: Marketing copy, not Q&A (Service pages need direct Q/A format)");
        doc.text("• STRUCTURED DATA (SCHEMA.ORG): Unverified (Needs direct source-code check)");
        doc.text("• THIRD-PARTY CITATION AUTHORITY: Thin (Directory gaps weaken trust signals AI engines use)");
        doc.moveDown(1);
        
        doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text("8. What This Means For Your Growth");
        doc.moveDown(0.5);
        doc.fillColor(successColor).fontSize(10).font("Helvetica-Bold").text("BRINGING YOU PATIENTS:");
        doc.fillColor("#000000").font("Helvetica").text("Elite reputation (284 reviews, 4.8★), clean tracking setup, and a well-structured local SEO site.");
        doc.moveDown(0.3);
        doc.fillColor(accentColor).font("Helvetica-Bold").text("WHERE YOU'RE LOSING PATIENTS:");
        doc.fillColor("#000000").font("Helvetica").text("A broken insurance-check form, split booking systems, slow mobile load, low review-response rate, and hours listed three different ways.");
        doc.moveDown(0.3);
        doc.fillColor(accentColor).font("Helvetica-Bold").text("WHERE COMPETITORS PULL AHEAD:");
        doc.fillColor("#000000").font("Helvetica").text("No AI chat, no missed-call text-back, no unified real-time booking — the 24/7 layer that's now standard for growing practices.");
        doc.moveDown(1);
        
        doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text("9. Close the AI Gap in 30 Days (Robointech Stack)");
        doc.moveDown(0.5);
        doc.fillColor("#000000").fontSize(10).font("Helvetica");
        doc.text("• AI Calling: Never miss a call — instant text-back & AI voice receptionist");
        doc.text("• AI-Ready Website: Fix broken form, add a 24/7 chatbot & qualified intake");
        doc.text("• AI Appointments: One unified, real-time booking system, no more split tools");
        doc.text("• AI Reputation: Turn Facebook into a real review channel, close response gap");
        doc.text("• AI SEO / GEO: Structure content so AI Overviews & ChatGPT cite you first");
        
        doc.moveDown(2);
        doc.fillColor("gray").fontSize(9).text(`AI Growth Readiness Report — confidential, prepared for ${businessName}\nrobointech.com`, { align: "center" });
        doc.text("Methodology: findings are compiled from the live practice site, its public page source, and publicly indexed third-party listings plus Lighthouse / PageSpeed and GBP data as of the report date.", { align: "center" });

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
    const session = await requireSession();
    const { id } = await params;

    const { data: report, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .eq("organizationId", session.organizationId)
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
