import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL || "";
  const maskedUrl = url.replace(/:[^@]+@/, ":****@");
  const username = url.split(":")[1]?.replace("//", "")?.split(":")[0] || "unknown";
  
  console.log(`[prisma] Initializing with user: ${username} on host: ${url.split("@")[1] || "unknown"}`);
  console.log(`[prisma] Masked URL: ${maskedUrl}`);

  return new PrismaClient({
    datasources: {
      db: {
        url: url
      }
    }
  });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
