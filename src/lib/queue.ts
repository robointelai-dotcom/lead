/**
 * Shared Redis connection + BullMQ queue definitions.
 *
 * Uses ioredis under the hood. Queues receive raw connection options
 * (BullMQ then owns the underlying connection lifecycle) which avoids
 * type conflicts between our top-level ioredis and BullMQ's bundled copy.
 * A separately-tracked `Redis` instance is exposed for direct commands
 * (e.g. workers or diagnostics).
 */

import IORedis, { Redis, type RedisOptions } from "ioredis";
import { Queue, QueueEvents, type ConnectionOptions } from "bullmq";

export const SEARCH_QUEUE_NAME = "leadflow-search";
export const GITHUB_DISPATCH_QUEUE_NAME = "leadflow-github-dispatch";
export const GHL_SYNC_QUEUE_NAME = "leadflow-ghl-sync";
export const IMPORT_QUEUE_NAME = "leadflow-import";

const globalForRedis = globalThis as unknown as {
  redisConnection?: Redis;
  searchQueue?: Queue;
  githubDispatchQueue?: Queue;
  ghlSyncQueue?: Queue;
  importQueue?: Queue;
  searchQueueEvents?: QueueEvents;
};

/**
 * Parse REDIS_URL into a plain options object BullMQ can safely accept.
 */
export function getRedisOptions(): ConnectionOptions {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  try {
    const parsed = new URL(url);
    const opts: RedisOptions = {
      host: parsed.hostname || "localhost",
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
    if (parsed.password) opts.password = decodeURIComponent(parsed.password);
    if (parsed.username && parsed.username !== "default")
      opts.username = decodeURIComponent(parsed.username);
    if (parsed.pathname && parsed.pathname.length > 1) {
      const db = parseInt(parsed.pathname.slice(1), 10);
      if (!Number.isNaN(db)) opts.db = db;
    }
    return opts as ConnectionOptions;
  } catch (err) {
    console.error("[redis] failed to parse REDIS_URL, using defaults:", err);
    return { host: "localhost", port: 6379, maxRetriesPerRequest: null } as ConnectionOptions;
  }
}

/**
 * Build (or reuse) a shared ioredis instance for direct command access
 * (used by workers, health checks, etc.).
 */
export function getRedisConnection(): Redis {
  if (globalForRedis.redisConnection) return globalForRedis.redisConnection;

  const url = process.env.REDIS_URL || "redis://localhost:6379";
  try {
    const connection = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
      retryStrategy: (times: number) => {
        // Give up after ~10 attempts so we don't spam logs in production
        // when REDIS_URL is misconfigured. Workers will simply stop retrying.
        if (times > 10) return null;
        return Math.min(times * 500, 5000);
      },
    });

    connection.on("error", (err) => {
      console.error("[redis] connection error:", err.message);
    });
    connection.on("connect", () => {
      console.log("[redis] connected:", url);
    });

    globalForRedis.redisConnection = connection;
    return connection;
  } catch (err) {
    console.error("[redis] failed to initialize connection:", err);
    throw err;
  }
}

export interface SearchJobPayload {
  searchJobId: string;
  organizationId: string;
  createdByUserId?: string | null;
  campaignId?: string | null;
  niche?: string;
  country?: string;
  state?: string;
  city?: string;
  postalCode?: string;
  radius?: number;
  maxResults?: number;
  minRating?: number;
  minReviewCount?: number;
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasWebsite?: boolean;
  autoFindEmails?: boolean;
  autoDispatchToGithub?: boolean;
  autoGenerateReport?: boolean;
}

export interface GithubDispatchPayload {
  organizationId: string;
  searchJobId?: string;
  eventType?: string;
  leads: Array<Record<string, unknown>>;
}

export interface GhlSyncPayload {
  organizationId: string;
  leadId: string;
  campaignLeadId?: string;
  reason?: string; // e.g. "callfluent-qualified" | "manual-status-change"
}

export interface ImportJobPayload {
  organizationId: string;
  campaignId: string;
  leads: any[]; // Array of lead objects parsed from CSV
  jobId?: string; // Optional reference to a search_jobs record
  autoDispatchToGithub?: boolean;
}

export function getSearchQueue(): Queue<SearchJobPayload> {
  if (globalForRedis.searchQueue)
    return globalForRedis.searchQueue as Queue<SearchJobPayload>;

  const queue = new Queue<SearchJobPayload>(SEARCH_QUEUE_NAME, {
    connection: getRedisOptions(),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 24 * 3600, count: 500 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  });

  globalForRedis.searchQueue = queue;
  return queue;
}

export function getGithubDispatchQueue(): Queue<GithubDispatchPayload> {
  if (globalForRedis.githubDispatchQueue)
    return globalForRedis.githubDispatchQueue as Queue<GithubDispatchPayload>;

  const queue = new Queue<GithubDispatchPayload>(GITHUB_DISPATCH_QUEUE_NAME, {
    connection: getRedisOptions(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 3000 },
      removeOnComplete: { age: 24 * 3600, count: 200 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  });

  globalForRedis.githubDispatchQueue = queue;
  return queue;
}

export function getSearchQueueEvents(): QueueEvents {
  if (globalForRedis.searchQueueEvents) return globalForRedis.searchQueueEvents;
  const events = new QueueEvents(SEARCH_QUEUE_NAME, {
    connection: getRedisOptions(),
  });
  globalForRedis.searchQueueEvents = events;
  return events;
}

export function getGhlSyncQueue(): Queue<GhlSyncPayload> {
  if (globalForRedis.ghlSyncQueue)
    return globalForRedis.ghlSyncQueue as Queue<GhlSyncPayload>;

  const queue = new Queue<GhlSyncPayload>(GHL_SYNC_QUEUE_NAME, {
    connection: getRedisOptions(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 4000 },
      removeOnComplete: { age: 24 * 3600, count: 500 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  });

  globalForRedis.ghlSyncQueue = queue;
  return queue;
}

export function getImportQueue(): Queue<ImportJobPayload> {
  if (globalForRedis.importQueue)
    return globalForRedis.importQueue as Queue<ImportJobPayload>;

  const queue = new Queue<ImportJobPayload>(IMPORT_QUEUE_NAME, {
    connection: getRedisOptions(),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 24 * 3600, count: 500 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  });

  globalForRedis.importQueue = queue;
  return queue;
}
