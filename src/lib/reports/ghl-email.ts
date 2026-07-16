/**
 * GHL Email Sender
 * ----------------
 * Uses GoHighLevel's Conversations API to send a transactional email
 * to a contact. Requires:
 *   • ghlAccessToken (Bearer)  — stored encrypted per org
 *   • ghlLocationId            — the target sub-account
 *
 * Behaviour when creds are missing / mocked:
 *   • ghlAccessToken absent            → skipped with clear log
 *   • ghlAccessToken === MOCK_TOKEN    → mock success, no network call
 *
 * Contact is upserted first (so a lead that doesn't yet exist in GHL
 * gets created), then the email is sent to that contact.
 *
 * GHL v2 endpoints used:
 *   POST /contacts/upsert
 *   POST /conversations/messages
 */

import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";
const MOCK = "MOCK_TOKEN";

export interface SendEmailInput {
  organizationId: string;
  toEmail: string;
  toName?: string;
  toPhone?: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  success: boolean;
  mocked?: boolean;
  contactId?: string;
  messageId?: string;
  error?: string;
}

async function resolveCreds(organizationId: string): Promise<{
  token: string | null;
  locationId: string | null;
  isMocked: boolean;
}> {
  try {
    const integ = await prisma.integration.findFirst({
      where: {
        organizationId,
        OR: [{ provider: "ghl" }, { provider: "gohighlevel" }],
        isActive: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!integ || !integ.ghlAccessToken || !integ.ghlLocationId) {
      return { token: null, locationId: integ?.ghlLocationId ?? null, isMocked: false };
    }

    let token = "";
    try {
      token = decryptToken(integ.ghlAccessToken);
    } catch (err) {
      console.error("[ghl-email] failed to decrypt access token:", (err as Error).message);
    }
    const isMocked = !token || token === MOCK;
    return { token, locationId: integ.ghlLocationId, isMocked };
  } catch (err) {
    console.error("[ghl-email] loadIntegration failed:", err);
    return { token: null, locationId: null, isMocked: false };
  }
}

function splitName(name?: string): { firstName?: string; lastName?: string } {
  if (!name) return {};
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] };
  const [first, ...rest] = parts;
  return { firstName: first, lastName: rest.join(" ") };
}

export async function sendGhlEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { organizationId, toEmail, toName, toPhone, subject, html } = input;

  if (!toEmail) return { success: false, error: "toEmail is required" };

  const { token, locationId, isMocked } = await resolveCreds(organizationId);

  if (!locationId) {
    return { success: false, error: "GHL not configured for this organization (no locationId)" };
  }

  if (isMocked || !token) {
    console.log(
      `[ghl-email][MOCK] Would send email to ${toEmail} — subject: "${subject}"`
    );
    return {
      success: true,
      mocked: true,
      contactId: `mock-contact`,
      messageId: `mock-msg`,
    };
  }

  const authHeader = {
    Authorization: `Bearer ${token}`,
    Version: GHL_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  try {
    // 1. Upsert contact
    const { firstName, lastName } = splitName(toName);
    const contactRes = await fetch(`${GHL_BASE}/contacts/upsert`, {
      method: "POST",
      headers: authHeader,
      body: JSON.stringify({
        locationId,
        email: toEmail,
        firstName,
        lastName,
        phone: toPhone,
        source: "LeadFlow Pro Growth Report",
        tags: ["leadflow-pro", "growth-report-recipient"],
      }),
    });

    if (!contactRes.ok) {
      const text = await contactRes.text();
      console.error("[ghl-email] contact upsert failed:", contactRes.status, text.slice(0, 300));
      return { success: false, error: `GHL contact upsert ${contactRes.status}: ${text.slice(0, 200)}` };
    }

    interface UpsertResp {
      contact?: { id?: string };
      id?: string;
    }
    const contactJson = (await contactRes.json()) as UpsertResp;
    const contactId = contactJson.contact?.id || contactJson.id;

    if (!contactId) {
      return { success: false, error: "GHL upsert succeeded but returned no contact id" };
    }

    // 2. Send email
    const msgRes = await fetch(`${GHL_BASE}/conversations/messages`, {
      method: "POST",
      headers: authHeader,
      body: JSON.stringify({
        type: "Email",
        contactId,
        subject,
        html,
      }),
    });

    if (!msgRes.ok) {
      const text = await msgRes.text();
      console.error("[ghl-email] send message failed:", msgRes.status, text.slice(0, 300));
      return { success: false, contactId, error: `GHL send ${msgRes.status}: ${text.slice(0, 200)}` };
    }

    const msgJson = (await msgRes.json()) as { messageId?: string; id?: string };
    const messageId = msgJson.messageId || msgJson.id;
    console.log(`[ghl-email] sent to ${toEmail} (contact=${contactId}, msg=${messageId})`);
    return { success: true, contactId, messageId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ghl-email] network error:", msg);
    return { success: false, error: msg };
  }
}
