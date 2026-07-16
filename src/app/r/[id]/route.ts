import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLead } from "@/lib/reports/audit";
import { renderReportHtml } from "@/lib/reports/template";

// Public route — no auth required. Returns raw HTML (not a React page)
// so the report renders as a full-page document, unaffected by the
// dashboard's root layout.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const report = await prisma.growthReport.findUnique({
    where: { id },
    include: {
      lead: true,
      organization: { select: { id: true, name: true, website: true } },
    },
  });

  if (!report) {
    return new Response("Report not found", {
      status: 404,
      headers: { "content-type": "text/plain" },
    });
  }

  // Best-effort view counter
  prisma.growthReport
    .update({ where: { id }, data: { viewedCount: { increment: 1 } } })
    .catch(() => {});

  // Path 1: HTML already in Supabase Storage → proxy it
  if (report.storageUrl) {
    try {
      const res = await fetch(report.storageUrl, { cache: "no-store" });
      if (res.ok) {
        const html = await res.text();
        return new Response(html, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=60",
          },
        });
      }
    } catch (err) {
      console.warn("[report/route] failed to fetch stored HTML:", (err as Error).message);
    }
  }

  // Path 2: Re-render from stored data or run a live audit
  let audit;
  try {
    if (report.dataJson && typeof report.dataJson === "object") {
      audit = report.dataJson as unknown as Awaited<ReturnType<typeof auditLead>>;
    } else if (report.status === "PENDING" || report.status === "GENERATING") {
      return new Response(pendingHtml(report.lead.businessName), {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    } else {
      audit = await auditLead(report.lead);
    }
  } catch (err) {
    console.error("[report/route] audit failed:", err);
    return new Response("Report generation error. Please retry.", {
      status: 500,
      headers: { "content-type": "text/plain" },
    });
  }

  const publicUrl = `${process.env.NEXTAUTH_URL || "https://leadflowtool.com"}/r/${report.id}`;
  const html = renderReportHtml({
    reportId: report.id,
    slug: report.slug,
    audit,
    niche: report.niche || report.lead.category || "generic",
    business: {
      name: report.lead.businessName,
      address: report.lead.address || undefined,
      website: report.lead.website || undefined,
      phone: report.lead.phone || undefined,
    },
    agency: {
      name: report.organization?.name || "Robointech",
      tagline: "AI-first growth studio",
      website: report.organization?.website || "https://robointelai.com",
    },
    generatedAt: report.createdAt,
    publicUrl,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}

function pendingHtml(name: string): string {
  const safe = name.replace(/</g, "&lt;");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Generating…</title>
<meta http-equiv="refresh" content="5">
<style>body{font-family:Georgia,serif;text-align:center;padding:80px 24px;background:#EDE9DD;color:#13232B;}h1{font-size:22px;margin:0 0 8px;}p{color:#4B5B60;}.spinner{width:44px;height:44px;border:4px solid #E1DCCE;border-top-color:#0E6F6E;border-radius:50%;animation:s 1s linear infinite;margin:24px auto;}@keyframes s{to{transform:rotate(360deg)}}</style>
</head><body>
<div class="spinner"></div>
<h1>Your report is being generated…</h1>
<p>Auditing ${safe}. This page will refresh automatically.</p>
</body></html>`;
}
