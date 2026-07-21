import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[prisma] DATABASE_URL is not set");
    throw new Error("DATABASE_URL is not set");
  }

  console.log("[prisma] initializing client with connection pool...");

  // Use a Pool for better connection management, especially with PgBouncer
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: connectionString.includes("supabase.com")
      ? { rejectUnauthorized: false }
      : false,
  });

  pool.on("error", (err) => {
    console.error("[prisma] unexpected error on idle database client:", err);
  });

  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });
  
  return client;
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
