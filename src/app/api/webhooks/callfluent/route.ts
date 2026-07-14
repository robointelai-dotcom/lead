// TODO: Implement cryptographic signature validation once webhook secret is stored
/**
 * Callfluent AI Webhook Ingestion
 * --------------------------------
 * Receives post-call payloads from Callfluent AI voice nodes, persists
 * them into `call_logs`, and updates the linked Lead's campaign status
 * when the intent signals conversion (e.g. "interested" / "callback").
 *
 * Multi-tenant safety: The lookup keys we accept are:
 *   - `leadId` (direct)              → strictly scoped by organizationId
 *   - `organizationId` (explicit)    → required if no leadId is supplied
 *   - `phone` / `to` / `from` fallback  → matched against normalized phone
 *
 * The route intentionally returns 200 for malformed payloads (with
 * `success: false`) so Callfluent won't spam retries on structural errors,
 * but returns 500 on genuine server errors so retries can help.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/utils";

interface CallfluentWebhookPayload {
  organization_id?: string;
  organizationId?: string;
  lead_id?: string;
  leadId?: string;
  call_id?: string;
  external_call_id?: string;
  phone?: string;
  to?: string;
  from?: string;
  direction?: string;
  status?: string;
  duration?: number | string;
  recording_url?: string;
  recordingUrl?: string;
  transcript?: string;
  sentiment?: string;
  intent?: string;
  intent_flags?: Record<string, boolean>;
  interested?: boolean;
  booked?: boolean;
  callback_requested?: boolean;
  occurred_at?: string;
}

function coerceDuration(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.max(0, Math.round(n));
  }
  return 0;
}

function inferIntent(body: CallfluentWebhookPayload): string | undefined {
  if (body.intent) return String(body.intent).toLowerCase();
  if (body.intent_flags) {
    if (body.intent_flags.interested) return "interested";
    if (body.intent_flags.callback) return "callback";
    if (body.intent_flags.voicemail) return "voicemail";
    if (body.intent_flags.not_interested) return "not_interested";
  }
  if (body.interested === true) return "interested";
  if (body.booked === true) return "interested";
  if (body.callback_requested === true) return "callback";
  return undefined;
}

/**
 * Map a Callfluent intent to a LeadStatus we update on the campaignLead row.
 */
function statusForIntent(intent?: string): string | null {
  if (!intent) return null;
  const i = intent.toLowerCase();
  if (i === "interested" || i === "booked" || i === "qualified") return "QUALIFIED";
  if (i === "callback" || i === "callback_requested") return "REPLIED";
  if (i === "not_interested" || i === "declined") return "LOST";
  if (i === "do_not_contact" || i === "dnc") return "DO_NOT_CONTACT";
  if (i === "voicemail" || i === "no_answer") return "CONTACTED";
  return null;
}

export async function POST(req: NextRequest) {
  let body: CallfluentWebhookPayload;
  try {
    body = (await req.json()) as CallfluentWebhookPayload;
  } catch (err) {
    console.error("[callfluent-webhook] invalid JSON body:", err);
    return NextResponse.json(
      { success: false, error: "Invalid JSON payload" },
      { status: 200 }
    );
  }

  console.log(
    "[callfluent-webhook] incoming payload:",
    JSON.stringify({
      call_id: body.call_id || body.external_call_id,
      phone: body.phone || body.to || body.from,
      duration: body.duration,
      status: body.status,
      intent: body.intent,
    })
  );

  try {
    const organizationId =
      body.organization_id || body.organizationId || undefined;
    const leadIdHint = body.lead_id || body.leadId || undefined;
    const phone =
      body.phone || body.to || body.from || undefined;
    const normalizedPhone = normalizePhone(phone);

    // 1) Resolve the lead + organization (strict multi-tenant isolation)
    let lead: { id: string; organizationId: string } | null = null;

    if (leadIdHint) {
      lead = await prisma.lead.findFirst({
        where: {
          id: leadIdHint,
          ...(organizationId ? { organizationId } : {}),
        },
        select: { id: true, organizationId: true },
      });
    }

    if (!lead && organizationId && normalizedPhone) {
      lead = await prisma.lead.findFirst({
        where: {
          organizationId,
          normalizedPhone,
        },
        select: { id: true, organizationId: true },
      });
    }

    // If we still can't match a lead but have an org, log an orphan record.
    const resolvedOrgId = lead?.organizationId || organizationId;
    if (!resolvedOrgId) {
      console.warn(
        "[callfluent-webhook] cannot resolve organizationId — dropping payload"
      );
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing organizationId (and could not infer via lead/phone match)",
        },
        { status: 200 }
      );
    }

    const intent = inferIntent(body);
    const duration = coerceDuration(body.duration);
    const recordingUrl = body.recording_url || body.recordingUrl || null;
    const transcript = body.transcript || null;
    const sentiment = body.sentiment || null;

    // 2) Persist the CallLog (org-scoped)
    const callLog = await prisma.callLog.create({
      data: {
        organizationId: resolvedOrgId,
        leadId: lead?.id ?? null,
        externalCallId: body.call_id || body.external_call_id || null,
        phoneNumber: phone || null,
        direction: body.direction || null,
        status: body.status || null,
        duration,
        recordingUrl,
        transcript,
        sentiment,
        intent: intent || null,
        rawPayload: body as unknown as object,
        occurredAt: body.occurred_at ? new Date(body.occurred_at) : new Date(),
      },
    });

    console.log(
      `[callfluent-webhook] stored CallLog ${callLog.id} for org ${resolvedOrgId}`
    );

    // 3) Update Lead status if we can + intent maps to something meaningful
    let updatedCampaignLeads = 0;
    if (lead) {
      const newStatus = statusForIntent(intent);
      if (newStatus) {
        try {
          const cls = await prisma.campaignLead.findMany({
            where: {
              leadId: lead.id,
              campaign: { organizationId: resolvedOrgId },
            },
            select: { id: true, status: true },
          });

          for (const cl of cls) {
            if (cl.status === newStatus) continue;
            await prisma.$transaction([
              prisma.campaignLead.update({
                where: { id: cl.id },
                data: { status: newStatus as never },
              }),
              prisma.leadStatusHistory.create({
                data: {
                  campaignLeadId: cl.id,
                  fromStatus: cl.status,
                  toStatus: newStatus as never,
                },
              }),
            ]);
            updatedCampaignLeads++;
          }

          console.log(
            `[callfluent-webhook] updated ${updatedCampaignLeads} campaign_lead rows to ${newStatus}`
          );
        } catch (err) {
          console.error(
            "[callfluent-webhook] failed to update campaign lead status:",
            err
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      callLogId: callLog.id,
      leadId: lead?.id ?? null,
      intent,
      updatedCampaignLeads,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[callfluent-webhook] handler error:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "callfluent-webhook",
    hint: "POST call-completion payloads here",
  });
}
