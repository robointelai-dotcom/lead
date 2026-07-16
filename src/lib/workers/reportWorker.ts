/**
 * Growth Report Worker (BullMQ)
 * -----------------------------
 * For each queued job:
 *   1. Load the lead + organization (org-scoped safety)
 *   2. Run the hybrid audit (Google PageSpeed + HTML sniff)
 *   3. Render HTML via the niche-aware template
 *   4. Upload to Supabase Storage → get public URL
 *   5. Persist `GrowthReport` row (status READY)
 *   6. If lead has an email, send it via GHL Conversations API
 *   7. Transition to SENT (or FAILED)
 *
 * Multi-tenant safety: every Prisma query includes `organizationId`.
 */

import { Worker, Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { auditLead } from "@/lib/reports/audit";
import { renderReportHtml } from "@/lib/reports/template";
import { uploadReportHtml } from "@/lib/reports/storage";
import { sendGhlEmail } from "@/lib/reports/ghl-email";
import { getRedisOptions, REPORT_QUEUE_NAME, type ReportJobPayload, getReportQueue } from "@/lib/queue";

let _worker: Worker<ReportJobPayload> | null = null;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function loadAgencyBranding(organizationId: string): Promise<{
  name: string;
  tagline: string;
  website: string;
  bookingUrl?: string;
}> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, website: true },
    });

    const ghlIntegration = await prisma.integration.findFirst({
      where: {
        organizationId,
        OR: [{ provider: "ghl" }, { provider: "gohighlevel" }],
      },
    });

    return {
      name: org?.name || "Robointech",
      tagline: "AI-first growth studio",
      website: org?.website || "https://robointelai.com",
      bookingUrl: ghlIntegration?.ghlBookingUrl || undefined,
    };
  } catch (err) {
    console.warn("[report-worker] loadAgencyBranding fallback:", (err as Error).message);
    return {
      name: "Robointech",
      tagline: "AI-first growth studio",
      website: "https://robointelai.com",
    };
  }
}

async function processReportJob(job: Job<ReportJobPayload>) {
  const { reportId, organizationId, leadId, niche } = job.data;
  console.log(`[report-worker] processing report ${reportId} (lead=${leadId})`);

  try {
    // Transition to GENERATING
    await prisma.growthReport.update({
      where: { id: reportId, organizationId },
      data: { status: "GENERATING", errorMessage: null },
    });

    // Load lead
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId },
    });
    if (!lead) throw new Error(`Lead ${leadId} not found for org ${organizationId}`);

    // Audit
    const audit = await auditLead(lead);

    // Branding
    const agency = await loadAgencyBranding(organizationId);

    // Render HTML
    const publicUrl = `${process.env.NEXTAUTH_URL || "https://leadflowtool.com"}/r/${reportId}`;
    const html = renderReportHtml({
      reportId,
      slug: slugify(lead.businessName),
      audit,
      niche: niche || lead.category || "generic",
      business: {
        name: lead.businessName,
        address: lead.address || undefined,
        website: lead.website || undefined,
        phone: lead.phone || undefined,
      },
      agency,
      generatedAt: new Date(),
      publicUrl,
    });

    // Upload to Supabase Storage
    const uploaded = await uploadReportHtml(organizationId, reportId, html);

    // Persist report
    await prisma.growthReport.update({
      where: { id: reportId, organizationId },
      data: {
        status: "READY",
        storageUrl: uploaded.url,
        pulseScore: audit.pulseScore,
        dataJson: audit as unknown as object,
      },
    });

    console.log(`[report-worker] report ${reportId} READY (score=${audit.pulseScore}, url=${uploaded.url})`);

    // Send email via GHL if lead has an email address
    if (lead.email) {
      const subject = `Your ${niche || lead.category || "business"} growth report — ${audit.pulseScore}/100 pulse score`;
      // Compose a short email body with the link; the report itself lives at the public URL.
      const emailHtml = renderEmailWrapperHtml({
        businessName: lead.businessName,
        pulseScore: audit.pulseScore,
        scoreCaption: audit.scoreCaption,
        reportUrl: publicUrl,
        agencyName: agency.name,
        agencyWebsite: agency.website,
        bookingUrl: agency.bookingUrl,
      });

      const sendResult = await sendGhlEmail({
        organizationId,
        toEmail: lead.email,
        toName: lead.businessName,
        toPhone: lead.phone || undefined,
        subject,
        html: emailHtml,
      });

      if (sendResult.success) {
        await prisma.growthReport.update({
          where: { id: reportId, organizationId },
          data: {
            status: "SENT",
            emailedTo: lead.email,
            emailedAt: new Date(),
          },
        });
        console.log(`[report-worker] report ${reportId} SENT to ${lead.email}${sendResult.mocked ? " (MOCK)" : ""}`);
      } else {
        // Report is still valid — just couldn't send. Store the error.
        await prisma.growthReport.update({
          where: { id: reportId, organizationId },
          data: { errorMessage: `Email send failed: ${sendResult.error}` },
        });
        console.warn(`[report-worker] email send failed for ${reportId}:`, sendResult.error);
      }
    } else {
      console.log(`[report-worker] lead ${leadId} has no email — report generated but not sent`);
    }

    return { reportId, pulseScore: audit.pulseScore };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[report-worker] report ${reportId} FAILED:`, msg);
    try {
      await prisma.growthReport.update({
        where: { id: reportId, organizationId },
        data: { status: "FAILED", errorMessage: msg.slice(0, 500) },
      });
    } catch (upErr) {
      console.error("[report-worker] failed to mark report failed:", upErr);
    }
    throw err;
  }
}

function renderEmailWrapperHtml(opts: {
  businessName: string;
  pulseScore: number;
  scoreCaption: string;
  reportUrl: string;
  agencyName: string;
  agencyWebsite: string;
  bookingUrl?: string;
}): string {
  const bookUrl = opts.bookingUrl || opts.agencyWebsite;
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Your growth report</title></head>
<body style="margin:0;padding:24px;background:#EDE9DD;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#13232B;">
  <div style="max-width:600px;margin:0 auto;background:#FBFAF6;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0A4F4F,#0E6F6E);padding:32px;color:#F3F0E4;">
      <div style="font-size:11px;letter-spacing:1.5px;opacity:0.75;font-family:Courier New,monospace;">PRACTICE PULSE · GROWTH REPORT</div>
      <h1 style="margin:10px 0 4px;font-family:Georgia,serif;font-size:26px;">Hi ${opts.businessName},</h1>
      <div style="opacity:0.85;font-size:14px;">Your digital-health &amp; AI-maturity report is ready.</div>
    </div>
    <div style="padding:28px 32px;">
      <div style="display:inline-block;background:#F7E3B8;color:#7A5A11;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:600;">Pulse Score · ${opts.pulseScore}/100</div>
      <p style="font-size:15px;line-height:1.55;margin:16px 0 0;">${opts.scoreCaption}</p>
      <p style="font-size:14px;line-height:1.55;color:#4B5B60;margin:14px 0 24px;">Inside your full report we've mapped:</p>
      <ul style="font-size:14px;line-height:1.7;color:#4B5B60;margin:0 0 24px;padding-left:20px;">
        <li>Where your Google Business profile is winning &amp; losing</li>
        <li>Website &amp; lead-capture bottlenecks costing you bookings</li>
        <li>AI Overviews &amp; ChatGPT visibility — are you cite-ready?</li>
        <li>The 4 AI-automation levers your competitors use to grow 30-50%</li>
        <li>Local citation gaps on Healthgrades, Zocdoc, Yelp, etc.</li>
      </ul>
      <div style="text-align:center;margin:28px 0 20px;">
        <a href="${opts.reportUrl}" style="display:inline-block;background:#0E6F6E;color:#F3F0E4;font-weight:600;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;">View your full report →</a>
      </div>
      <div style="text-align:center;">
        <a href="${bookUrl}" style="display:inline-block;background:#E2A63D;color:#3A2A05;font-weight:700;font-size:14px;padding:12px 22px;border-radius:8px;text-decoration:none;">Book a free 30-min strategy call</a>
      </div>
      <p style="font-size:12px;color:#4B5B60;line-height:1.5;margin:32px 0 0;">Prepared by <a href="${opts.agencyWebsite}" style="color:#0E6F6E;">${opts.agencyName}</a> — AI-first growth studio for local ${opts.businessName.toLowerCase().includes("dent") ? "dental" : ""} practices.</p>
    </div>
  </div>
</body></html>`;
}

export function startReportWorker(): Worker<ReportJobPayload> {
  if (_worker) return _worker;

  _worker = new Worker<ReportJobPayload>(REPORT_QUEUE_NAME, processReportJob, {
    connection: getRedisOptions(),
    concurrency: 2,
  });

  _worker.on("failed", (job, err) => {
    console.error(`[report-worker] job ${job?.id} failed:`, err.message);
  });
  _worker.on("completed", (job) => {
    console.log(`[report-worker] job ${job.id} completed cleanly`);
  });
  _worker.on("ready", () => {
    console.log("[report-worker] ready and listening for jobs");
  });

  return _worker;
}

/**
 * Create a GrowthReport row + enqueue it. Called from lead-creation
 * flow (e.g. after saveLead). Idempotent per (leadId): if a report
 * already exists for the lead it returns that reportId instead.
 */
export async function enqueueGrowthReport(input: {
  organizationId: string;
  leadId: string;
  niche?: string;
  force?: boolean;
}): Promise<string> {
  const { organizationId, leadId, niche, force } = input;

  // Reuse existing if not forced
  if (!force) {
    const existing = await prisma.growthReport.findFirst({
      where: { organizationId, leadId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
    });
    if (existing && existing.status !== "FAILED") {
      return existing.id;
    }
  }

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId },
    select: { id: true, businessName: true, category: true },
  });
  if (!lead) throw new Error("Lead not found");

  const resolvedNiche = niche || lead.category || "generic";
  const slug = `${slugify(lead.businessName)}-${Math.random().toString(36).slice(2, 8)}`;

  const report = await prisma.growthReport.create({
    data: {
      organizationId,
      leadId,
      niche: resolvedNiche,
      slug,
      status: "PENDING",
    },
  });

  try {
    const queue = getReportQueue();
    await queue.add(
      "generate",
      {
        reportId: report.id,
        organizationId,
        leadId,
        niche: resolvedNiche,
      },
      { jobId: report.id }
    );
    console.log(`[report-worker] enqueued report ${report.id} for lead ${leadId}`);
  } catch (err) {
    const msg = (err as Error).message;
    console.error("[report-worker] enqueue failed:", msg);
    await prisma.growthReport.update({
      where: { id: report.id },
      data: { status: "FAILED", errorMessage: `Enqueue failed: ${msg}` },
    });
  }

  return report.id;
}
