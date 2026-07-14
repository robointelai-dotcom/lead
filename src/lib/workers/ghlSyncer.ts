/**
 * GoHighLevel CRM Sync Worker
 * ---------------------------
 * When a lead reaches the QUALIFIED stage (via Callfluent webhook,
 * manual status change, or any future auto-trigger), we push it into
 * the tenant's GHL sub-account so the downstream sales / nurture
 * workflows can pick it up.
 *
 * GHL v2 API:
 *   POST https://services.leadconnectorhq.com/contacts/upsert
 *   Authorization: Bearer <ghlAccessToken>
 *   Version: 2021-07-28
 *
 * Multi-tenant isolation: every lookup filters by organizationId and
 * the credentials come from that org's `integrations` row.
 *
 * MOCK MODE: if no `ghlAccessToken` is stored or the decrypted value
 * equals `MOCK_TOKEN`, we short-circuit with a logged fake success —
 * the exact same pattern used by the GitHub dispatcher.
 */

import { Worker, Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import {
  getGhlSyncQueue,
  getRedisOptions,
  GHL_SYNC_QUEUE_NAME,
  type GhlSyncPayload,
} from "@/lib/queue";

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";
const MOCK_TOKEN_SENTINEL = "MOCK_TOKEN";

export interface GhlSyncResult {
  success: boolean;
  mocked?: boolean;
  contactId?: string;
  status?: number;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

/**
 * Load the GHL-capable Integration row for this organization.
 * We prefer a row with `provider="ghl"` but fall back to any row
 * that has a non-null `ghlAccessToken` (in case the user saved it
 * under a different provider name).
 */
async function loadGhlIntegration(organizationId: string) {
  try {
    return await prisma.integration.findFirst({
      where: {
        organizationId,
        OR: [
          { provider: "ghl" },
          { provider: "gohighlevel" },
          { ghlAccessToken: { not: null } },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });
  } catch (err) {
    console.error("[ghl-syncer] failed to load integration:", err);
    return null;
  }
}

/**
 * Resolve the plaintext access token. MOCK if empty / sentinel.
 */
function resolveAccessToken(encrypted?: string | null): {
  token: string;
  isMocked: boolean;
} {
  let token = "";
  if (encrypted) {
    try {
      token = decryptToken(encrypted);
    } catch (err) {
      console.error("[ghl-syncer] failed to decrypt access token:", err);
      token = "";
    }
  }
  const isMocked = !token || token === MOCK_TOKEN_SENTINEL;
  return { token, isMocked };
}

/**
 * Split a business/contact name into first/last for GHL. GHL prefers
 * `firstName`+`lastName`, but also accepts a single `name`.
 */
function splitName(fullName: string | null | undefined): {
  firstName?: string;
  lastName?: string;
  name?: string;
} {
  if (!fullName) return {};
  const trimmed = fullName.trim();
  if (!trimmed) return {};
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], name: trimmed };
  }
  const [first, ...rest] = parts;
  return { firstName: first, lastName: rest.join(" "), name: trimmed };
}

/**
 * Build the GHL contact payload from a Lead + its most recent
 * CampaignLead status.
 */
function buildGhlContactPayload(
  lead: {
    businessName: string;
    email: string | null;
    phone: string | null;
    website: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postalCode: string | null;
    category: string | null;
  },
  locationId: string,
  extraTags: string[] = []
): Record<string, unknown> {
  const { firstName, lastName, name } = splitName(lead.businessName);
  return {
    locationId,
    firstName,
    lastName,
    name: name || lead.businessName,
    companyName: lead.businessName,
    email: lead.email || undefined,
    phone: lead.phone || undefined,
    website: lead.website || undefined,
    address1: lead.address || undefined,
    city: lead.city || undefined,
    state: lead.state || undefined,
    country: lead.country || undefined,
    postalCode: lead.postalCode || undefined,
    source: "LeadFlow Pro",
    tags: Array.from(
      new Set(
        [
          "leadflow-pro",
          lead.category ? `category:${lead.category.toLowerCase()}` : null,
          ...extraTags,
        ].filter(Boolean) as string[]
      )
    ),
  };
}

/**
 * Actually push a single lead to GHL. Uses `contacts/upsert` so we
 * never create duplicates for the same phone/email in a location.
 *
 * Callable directly (from anywhere in the app), or via the BullMQ worker.
 */
export async function syncLeadToGhl(
  organizationId: string,
  leadId: string,
  campaignLeadId?: string
): Promise<GhlSyncResult> {
  if (!organizationId || !leadId) {
    return { success: false, error: "organizationId and leadId are required" };
  }

  // 1) Load the tenant's GHL credentials
  const integration = await loadGhlIntegration(organizationId);
  if (!integration || !integration.ghlLocationId) {
    console.warn(
      `[ghl-syncer] no GHL integration/location configured for org ${organizationId} — skipping`
    );
    return {
      success: true,
      skipped: true,
      reason: "no-ghl-integration",
    };
  }

  const { token, isMocked } = resolveAccessToken(integration.ghlAccessToken);
  const locationId = integration.ghlLocationId;

  // 2) Load the lead row (org-scoped)
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId },
    select: {
      id: true,
      businessName: true,
      email: true,
      phone: true,
      website: true,
      address: true,
      city: true,
      state: true,
      country: true,
      postalCode: true,
      category: true,
    },
  });

  if (!lead) {
    return {
      success: false,
      error: `Lead ${leadId} not found for organization ${organizationId}`,
    };
  }

  // Optional: fetch the campaign_lead status so we can tag with it.
  let statusTag: string | null = null;
  if (campaignLeadId) {
    try {
      const cl = await prisma.campaignLead.findFirst({
        where: {
          id: campaignLeadId,
          campaign: { organizationId },
        },
        select: { status: true },
      });
      if (cl?.status) statusTag = `status:${String(cl.status).toLowerCase()}`;
    } catch (err) {
      console.error("[ghl-syncer] campaignLead status lookup failed:", err);
    }
  }

  const payload = buildGhlContactPayload(
    lead,
    locationId,
    statusTag ? [statusTag] : []
  );

  // 3) Mock short-circuit
  if (isMocked) {
    console.log(
      `[ghl-syncer][MOCK] Would upsert contact "${lead.businessName}" into GHL location ${locationId} for org ${organizationId}`
    );
    return {
      success: true,
      mocked: true,
      contactId: `mock-${lead.id}`,
      status: 200,
    };
  }

  // 4) Real HTTP call
  const url = `${GHL_API_BASE}/contacts/upsert`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Version: GHL_API_VERSION,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const bodyText = await res.text();
    if (res.ok) {
      let contactId: string | undefined;
      try {
        const json = JSON.parse(bodyText) as {
          contact?: { id?: string };
          id?: string;
        };
        contactId = json.contact?.id || json.id;
      } catch {
        // GHL sometimes returns 200 with empty body on no-op upsert
      }
      console.log(
        `[ghl-syncer] upserted lead ${lead.id} into GHL location ${locationId} (contactId=${contactId ?? "n/a"})`
      );
      return { success: true, status: res.status, contactId };
    }

    console.error(
      `[ghl-syncer] GHL API responded ${res.status}: ${bodyText.slice(0, 400)}`
    );
    return {
      success: false,
      status: res.status,
      error: `GHL API ${res.status}: ${bodyText.slice(0, 300)}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ghl-syncer] network/upsert failure:", msg);
    return { success: false, error: msg };
  }
}

/**
 * Fire-and-forget helper: enqueue a GHL sync for a lead.
 * Idempotent per (leadId, reason) — attempts are collapsed by jobId.
 */
export async function enqueueGhlSync(payload: GhlSyncPayload) {
  try {
    const queue = getGhlSyncQueue();
    const jobId = `ghl-sync-${payload.leadId}-${payload.reason || "auto"}`;
    const job = await queue.add("sync", payload, { jobId });
    console.log(
      `[ghl-syncer] enqueued sync for lead ${payload.leadId} (reason=${payload.reason || "auto"})`
    );
    return job.id;
  } catch (err) {
    console.error("[ghl-syncer] failed to enqueue sync:", err);
    // Non-fatal — GHL sync is best-effort.
    return null;
  }
}

/**
 * Boot the BullMQ worker. Idempotent.
 */
let _ghlWorker: Worker<GhlSyncPayload> | null = null;

export function startGhlSyncWorker(): Worker<GhlSyncPayload> {
  if (_ghlWorker) return _ghlWorker;

  _ghlWorker = new Worker<GhlSyncPayload>(
    GHL_SYNC_QUEUE_NAME,
    async (job: Job<GhlSyncPayload>) => {
      const { organizationId, leadId, campaignLeadId, reason } = job.data;
      console.log(
        `[ghl-syncer-worker] processing job ${job.id} lead=${leadId} reason=${reason || "auto"}`
      );
      const result = await syncLeadToGhl(organizationId, leadId, campaignLeadId);
      if (!result.success) {
        throw new Error(result.error || "GHL sync failed");
      }
      return result;
    },
    { connection: getRedisOptions(), concurrency: 3 }
  );

  _ghlWorker.on("failed", (job, err) => {
    console.error(
      `[ghl-syncer-worker] job ${job?.id} failed:`,
      err.message
    );
  });
  _ghlWorker.on("completed", (job) => {
    console.log(`[ghl-syncer-worker] job ${job.id} completed`);
  });

  return _ghlWorker;
}
