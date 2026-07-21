import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error("[prisma] DATABASE_URL is not set");
      return new PrismaClient();
    }

    console.log("[prisma] initializing standard client");

    return new PrismaClient({
      datasources: {
        db: {
          url: connectionString,
        },
      },
    });
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
