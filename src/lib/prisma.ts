import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = (process.env.DATABASE_URL || "").trim();
  if (!url) {
    console.error("[prisma] CRITICAL: DATABASE_URL is not set or empty");
    return new PrismaClient();
  }

  // Masked URL for logging
  const maskedUrl = url.replace(/:[^@]+@/, ":****@");
  const urlParts = url.split("@");
  const host = urlParts[1] || "unknown";
  const userInfo = urlParts[0]?.split("://")[1] || "";
  const [username] = userInfo.split(":");

  console.log(`[prisma] Attempting connection to host: ${host}`);
  console.log(`[prisma] Using username: ${username}`);
  console.log(`[prisma] Masked Connection URL: ${maskedUrl}`);
  console.log(`[prisma] URL Length: ${url.length} chars`);

  try {
    const pool = new Pool({
      connectionString: url,
      max: 5,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });

    pool.on("error", (err) => {
      console.error("[prisma] Pool Error:", err.message);
    });

    // Test the pool immediately
    pool.connect((err, client, release) => {
      if (err) {
        console.error("[prisma] Initial Pool Connection Test FAILED:", err.message);
      } else {
        console.log("[prisma] Initial Pool Connection Test SUCCESSFUL");
        release();
      }
    });

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

export const prisma = globalForPrisma.prisma;
