import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error("[prisma] DATABASE_URL is not set");
      // Don't throw here, return a dummy client or handle it in the proxy
      return new PrismaClient();
    }

    console.log("[prisma] initializing client for:", connectionString.split("@")[1] || "local");

    const pool = new Pool({
      connectionString,
      max: 10,
      ssl: connectionString.includes("supabase.com")
        ? { rejectUnauthorized: false }
        : false,
    });

    pool.on("error", (err) => {
      console.error("[prisma] pool error:", err);
    });

    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  } catch (err) {
    console.error("[prisma] failed to create client:", err);
    return new PrismaClient();
  }
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    try {
      const client = getPrismaClient();
      const value = Reflect.get(client, prop, receiver);
      return typeof value === "function" ? value.bind(client) : value;
    } catch (err) {
      console.error(`[prisma] proxy error on property ${String(prop)}:`, err);
      throw err;
    }
  },
});
