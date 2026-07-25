import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireSession } from "@/lib/auth";
import { stringify } from "csv-stringify/sync";
import PDFDocument from "pdfkit";

async function createPdfBuffer(report: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];
      doc.on("data", (b) => buffers.push(b));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      doc.fontSize(24).font("Helvetica-Bold").text(report.name, { align: "center" });
      doc.moveDown(1.5);

      const data = report.data || {};

      if (report.type === "CAMPAIGN") {
        const stats = data.stats || {};
        doc.fontSize(16).text("Campaign Statistics", { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).font("Helvetica");
        for (const [key, value] of Object.entries(stats)) {
          doc.text(`${key}: ${value}`);
        }
      } else if (report.type === "CUSTOM") {
        const lead = data.lead || {};
        const memberships = data.memberships || [];
        
        doc.fontSize(16).font("Helvetica-Bold").text("Lead Profile", { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).font("Helvetica");
        
        doc.text(`Business Name: ${lead.businessName || "N/A"}`);
        doc.text(`Email: ${lead.email || "N/A"}`);
        doc.text(`Phone: ${lead.phone || "N/A"}`);
        doc.text(`Website: ${lead.website || "N/A"}`);
        doc.text(`Quality Score: ${lead.qualityScore || "0"}/100`);
        doc.text(`Category: ${lead.category || "N/A"}`);
        doc.text(`Address: ${lead.address || ""}, ${lead.city || ""}, ${lead.state || ""}`);
        
        doc.moveDown(1.5);
        doc.fontSize(16).font("Helvetica-Bold").text("Campaign Memberships", { underline: true });
        doc.moveDown(0.5);
        
        doc.fontSize(12).font("Helvetica");
        if (memberships.length === 0) {
          doc.text("No active campaigns.");
        } else {
          memberships.forEach((m: any) => {
            doc.text(`- ${m.campaignName || "Unknown"}: ${m.status}`);
          });
        }
      } else {
        doc.fontSize(12).font("Helvetica").text(JSON.stringify(data, null, 2));
      }

      doc.moveDown(2);
      doc.fontSize(10).fillColor("gray").text(`Generated on: ${new Date().toLocaleString()}`, { align: "center" });

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
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="report-${report.name.replace(/\s+/g, "-")}.pdf"`,
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
