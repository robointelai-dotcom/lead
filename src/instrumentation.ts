/**
 * Next.js instrumentation hook.
 * Boots the BullMQ workers in-process when the Next server starts so
 * developers don't need to run a separate worker process locally.
 *
 * In production you'd typically run `scripts/worker.ts` as its own
 * process. If Redis is unreachable (e.g. misconfigured REDIS_URL),
 * we log and continue rather than crashing the whole app — the
 * public HTTP surface must still serve pages even without background
 * workers.
 */

const AUTOSTART = process.env.LEADFLOW_AUTOSTART_WORKERS === "true";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!AUTOSTART) {
    console.log("[instrumentation] LEADFLOW_AUTOSTART_WORKERS=false — skipping worker boot");
    return;
  }

  // Prevent double-registration under hot reload.
  const g = globalThis as unknown as { __leadflowWorkersStarted?: boolean };
  if (g.__leadflowWorkersStarted) return;
  g.__leadflowWorkersStarted = true;

  try {
    const { startSearchWorker } = await import("@/lib/workers/searchWorker");
    const { startGithubDispatchWorker } = await import(
      "@/lib/workers/githubDispatcher"
    );
    const { startGhlSyncWorker } = await import("@/lib/workers/ghlSyncer");

    startSearchWorker();
    startGithubDispatchWorker();
    startGhlSyncWorker();

    console.log("[instrumentation] Workers registered in Next.js process");
  } catch (err) {
    console.error(
      "[instrumentation] Failed to boot workers (non-fatal — app will continue serving HTTP):",
      err instanceof Error ? err.message : err
    );
  }
}
