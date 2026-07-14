/**
 * Standalone worker entrypoint.
 *
 * Runs both the search worker and the GitHub dispatch worker in the
 * same Node process. Started by supervisor.
 *
 *   Usage: npx tsx scripts/worker.ts
 */

import "dotenv/config";
import { startSearchWorker } from "../src/lib/workers/searchWorker";
import { startGithubDispatchWorker } from "../src/lib/workers/githubDispatcher";

async function main() {
  console.log("[worker] booting LeadFlow Pro background workers…");

  try {
    const searchWorker = startSearchWorker();
    const dispatchWorker = startGithubDispatchWorker();

    console.log("[worker] ✅ search worker running");
    console.log("[worker] ✅ github-dispatch worker running");

    const shutdown = async (signal: string) => {
      console.log(`[worker] received ${signal}, shutting down…`);
      try {
        await Promise.allSettled([
          searchWorker.close(),
          dispatchWorker.close(),
        ]);
      } catch (err) {
        console.error("[worker] error during shutdown:", err);
      }
      process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    console.error("[worker] failed to start:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[worker] fatal error:", err);
  process.exit(1);
});
