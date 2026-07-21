import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  let url = (process.env.DATABASE_URL || "").trim();

  // During build time on Hostinger, env vars might be missing. 
  // We set the env var manually to satisfy Prisma 7's requirement for a valid string.
  if (!url) {
    console.warn("[prisma] DATABASE_URL is not set, using fallback for build process");
    process.env.DATABASE_URL = "postgresql://dummy:dummy@localhost:5432/dummy";
    return new PrismaClient();
  }

  console.log(`[prisma] URL Length: ${url.length} chars`);

  try {
    const pool = new Pool({
      connectionString: url,
      max: 5,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });

    pool.on("error", (err) => console.error("[prisma] Pool Error:", err.message));

    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  } catch (err: any) {
    console.error("[prisma] Fatal Initialization Error:", err.message);
    return new PrismaClient();
  }
}

// Singleton pattern
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = createPrismaClient();
}

export const prisma = globalForPrisma.prisma as PrismaClient;
