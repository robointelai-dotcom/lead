/**
 * GitHub Event Dispatch Engine
 * ----------------------------
 * Fires a `repository_dispatch` event at
 *   https://api.github.com/repos/{owner}/{repo}/dispatches
 *
 * The companion repo `robointelai-dotcom/Workflow-Automation-`
 * listens for `event_type: "leadflow_outreach_trigger"` and forwards
 * the payload's `client_payload.data` array to `src/orchestrator.js`.
 *
 * Behaviour when GitHub credentials are missing (or set to `MOCK_TOKEN`):
 *   - No real HTTP call is made.
 *   - A fake successful response is returned so downstream code paths
 *     can be smoke-tested end-to-end without external dependencies.
 */

import { Worker, Job } from "bullmq";
import { supabase } from "@/lib/supabase";
import { decryptToken } from "@/lib/crypto";
import { getGithubDispatchQueue, type GithubDispatchPayload } from "@/lib/queue";
import { getRedisOptions, GITHUB_DISPATCH_QUEUE_NAME } from "@/lib/queue";

const GITHUB_API_BASE = "https://api.github.com";
const DEFAULT_EVENT_TYPE = "leadflow_outreach_trigger";
const MOCK_TOKEN_SENTINEL = "MOCK_TOKEN";

export interface DispatchResult {
  success: boolean;
  status?: number;
  mocked?: boolean;
  message?: string;
  error?: string;
}

interface DispatchOptions {
  organizationId: string;
  leads: Array<Record<string, unknown>>;
  eventType?: string;
  searchJobId?: string;
}

/**
 * Fetch the org-scoped Integration row that holds GitHub credentials.
 * We always scope by organizationId so tenants stay isolated.
 */
async function loadGithubIntegration(organizationId: string) {
  try {
    const { data: integration, error } = await supabase
      .from("integrations")
      .select("*")
      .eq("organizationId", organizationId)
      .or("provider.eq.github,githubToken.not.is.null")
      .order("updatedAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return integration;
  } catch (err) {
    console.error(
      "[github-dispatcher] failed to load integration for org",
      organizationId,
      err
    );
    return null;
  }
}

/**
 * Resolve which token to use. Priority:
 *   1) integration.githubToken (decrypted)
 *   2) process.env.GITHUB_TOKEN
 *   3) MOCK_TOKEN sentinel
 */
function resolveToken(encryptedTokenFromDb: string | null | undefined): {
  token: string;
  isMocked: boolean;
} {
  let token = "";

  if (encryptedTokenFromDb) {
    try {
      token = decryptToken(encryptedTokenFromDb);
    } catch (err) {
      console.error("[github-dispatcher] failed to decrypt token:", err);
      token = "";
    }
  }

  if (!token) token = process.env.GITHUB_TOKEN || "";

  const isMocked = !token || token === MOCK_TOKEN_SENTINEL;
  return { token, isMocked };
}

/**
 * Actually send the repository_dispatch event.
 */
export async function dispatchGithubRepositoryEvent(
  options: DispatchOptions
): Promise<DispatchResult> {
  const { organizationId, leads, eventType, searchJobId } = options;

  if (!organizationId) {
    return { success: false, error: "organizationId is required" };
  }

  const integration = await loadGithubIntegration(organizationId);
  const { token, isMocked } = resolveToken(integration?.githubToken);

  const owner = integration?.githubRepoOwner || "robointelai-dotcom";
  const repo = integration?.githubRepoName || "Workflow-Automation-";
  const branch = integration?.githubTargetBranch || "main";
  const evt = eventType || DEFAULT_EVENT_TYPE;

  const clientPayload = {
    organizationId,
    searchJobId: searchJobId || null,
    dispatchedAt: new Date().toISOString(),
    branch,
    data: leads,
    count: leads.length,
  };

  if (isMocked) {
    console.log(
      `[github-dispatcher][MOCK] Would dispatch ${leads.length} leads to ` +
        `${owner}/${repo} (event=${evt}) — no live token configured.`
    );
    return {
      success: true,
      mocked: true,
      status: 204,
      message: `MOCK: dispatched ${leads.length} leads to ${owner}/${repo}`,
    };
  }

  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/dispatches`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "LeadFlow-Pro-Dispatcher/1.0",
      },
      body: JSON.stringify({
        event_type: evt,
        client_payload: clientPayload,
      }),
    });

    if (res.status === 204) {
      console.log(
        `[github-dispatcher] SUCCESS: dispatched ${leads.length} leads to ${owner}/${repo} (${evt})`
      );
      return { success: true, status: 204 };
    }

    const errBody = await res.text().catch(() => "");
    console.error(
      `[github-dispatcher] GitHub API responded ${res.status}: ${errBody}`
    );
    return {
      success: false,
      status: res.status,
      error: `GitHub API error ${res.status}: ${errBody.slice(0, 400)}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[github-dispatcher] network/dispatch failure:", msg);
    return { success: false, error: msg };
  }
}

/**
 * Enqueue a background dispatch. Preferred for large batches so the
 * request cycle stays snappy.
 */
export async function enqueueGithubDispatch(payload: GithubDispatchPayload) {
  try {
    const queue = getGithubDispatchQueue();
    const job = await queue.add("dispatch", payload, {
      jobId: payload.searchJobId
        ? `dispatch-${payload.searchJobId}`
        : undefined,
    });
    console.log(
      `[github-dispatcher] enqueued dispatch job ${job.id} with ${payload.leads.length} leads`
    );
    return job.id;
  } catch (err) {
    console.error("[github-dispatcher] failed to enqueue dispatch:", err);
    throw err;
  }
}

/**
 * Start the BullMQ worker that consumes GitHub-dispatch jobs.
 * Idempotent — safe to call from multiple entrypoints.
 */
let _githubWorker: Worker<GithubDispatchPayload> | null = null;

export function startGithubDispatchWorker(): Worker<GithubDispatchPayload> {
  if (_githubWorker) return _githubWorker;

  _githubWorker = new Worker<GithubDispatchPayload>(
    GITHUB_DISPATCH_QUEUE_NAME,
    async (job: Job<GithubDispatchPayload>) => {
      const { organizationId, leads, eventType, searchJobId } = job.data;
      console.log(
        `[github-dispatcher-worker] processing job ${job.id} (${leads.length} leads)`
      );
      const result = await dispatchGithubRepositoryEvent({
        organizationId,
        leads,
        eventType,
        searchJobId,
      });
      if (!result.success) {
        throw new Error(result.error || "GitHub dispatch failed");
      }
      return result;
    },
    { connection: getRedisOptions(), concurrency: 2 }
  );

  _githubWorker.on("failed", (job, err) => {
    console.error(
      `[github-dispatcher-worker] job ${job?.id} failed:`,
      err.message
    );
  });
  _githubWorker.on("completed", (job) => {
    console.log(`[github-dispatcher-worker] job ${job.id} completed`);
  });

  return _githubWorker;
}
