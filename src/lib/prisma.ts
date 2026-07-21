import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = (process.env.DATABASE_URL || "").trim();
  if (!url) {
    console.error("[prisma] DATABASE_URL is not set");
    return new PrismaClient();
  }

  // Masked URL for logging
  const maskedUrl = url.replace(/:[^@]+@/, ":****@");
  console.log(`[prisma] Initializing pool for: ${maskedUrl}`);

  try {
    const pool = new Pool({
      connectionString: url,
      max: 10,
      ssl: { rejectUnauthorized: false }, // Critical for Supabase on Hostinger
      connectionTimeoutMillis: 10000,
    });

    pool.on("error", (err) => {
      console.error("[prisma] pool error:", err);
    });

    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  } catch (err) {
    console.error("[prisma] failed to initialize Pool:", err);
    return new PrismaClient();
  }
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
