import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  let url = (process.env.DATABASE_URL || "").trim();
  let isFallback = false;

  if (!url) {
    console.warn("[prisma] DATABASE_URL is not set, using fallback for build process");
    url = "postgresql://dummy:dummy@localhost:5432/dummy";
    isFallback = true;
  }

  try {
    // Basic URL parsing for logging to help with ECONNREFUSED
    const hostPortMatch = url.match(/@([^/]+)/);
    const hostPort = hostPortMatch ? hostPortMatch[1] : "unknown";
    if (!isFallback) {
      console.log(`[prisma] Attempting connection to: ${hostPort}`);
    }

    const pool = new Pool({
      connectionString: url,
      max: isFallback ? 1 : 5,
      ssl: isFallback ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });

    // We don't want to log errors during the dummy build connection
    if (!isFallback) {
      pool.on("error", (err) => console.error("[prisma] Pool Error:", err.message));
    }

    const adapter = new PrismaPg(pool);
    
    // When using an adapter, Prisma 7 expects it as the ONLY configuration
    return new PrismaClient({ adapter });
  } catch (err: any) {
    console.error("[prisma] Fatal Initialization Error:", err.message);
    // Last ditch effort to not crash the build
    return new PrismaClient();
  }
}

// Singleton pattern
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = createPrismaClient();
}

export const prisma = globalForPrisma.prisma as PrismaClient;
