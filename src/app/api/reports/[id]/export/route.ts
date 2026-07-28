import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { stringify } from "csv-stringify/sync";
import { generateReportPdf } from "@/lib/pdf-generator";

/**
 * GET /api/reports/[id]/export
 * Exports a specific report as a PDF, CSV or JSON file.
 */
import crypto from "crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = req.nextUrl.searchParams.get("token");
    const format = req.nextUrl.searchParams.get("format") || "json";

    // Phase 7: Secure Public Report Links
    // Verify token using timing-safe comparison if a token is provided.
    // If no token is provided, require authentication (we'd use getSession() here, but for brevity we'll enforce the token).
    if (!token) {
      return NextResponse.json({ error: "Missing access token" }, { status: 401 });
    }

    const secret = process.env.REPORT_LINK_SECRET || "fallback_secret";
    try {
      const decoded = Buffer.from(token, "base64").toString("utf-8");
      const { reportId, expiresAt, signature } = JSON.parse(decoded);
      
      if (reportId !== id) {
        return NextResponse.json({ error: "Invalid token for this report" }, { status: 403 });
      }

      if (Date.now() > expiresAt) {
        return NextResponse.json({ error: "Token expired" }, { status: 410 });
      }

      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(`${reportId}:${expiresAt}`)
        .digest("hex");

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return NextResponse.json({ error: "Invalid token signature" }, { status: 403 });
      }
    } catch (e) {
      return NextResponse.json({ error: "Malformed token" }, { status: 400 });
    }

    let { data: report, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!report) {
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

    if (format === "pdf") {
      const pdf = await generateReportPdf(report as any);
      return new NextResponse(pdf.buffer as any, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${pdf.filename}"`,
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
