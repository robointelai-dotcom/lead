import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = (process.env.DATABASE_URL || "").trim();
  
  // During build time on Hostinger, env vars might be missing. 
  // We provide a dummy URL to prevent Prisma 7 from crashing during static analysis.
  if (!url) {
    console.warn("[prisma] DATABASE_URL is not set, using fallback for build process");
    return new PrismaClient({
      datasources: {
        db: {
          url: "postgresql://dummy:dummy@localhost:5432/dummy"
        }
      }
    });
  }

  console.log(`[prisma] URL Length: ${url.length} chars`);

  try {
    // Manually parse the URL to be 100% sure about the components
    const regex = /^postgresql:\/\/([^:]+):([^@]+)@([^:/]+):(\d+)\/([^?]+)(\?.*)?$/;
    const match = url.match(regex);

    if (match) {
      const [, user, password, host, port, database] = match;
      console.log(`[prisma] Explicit Config - User: ${user}, Host: ${host}, Port: ${port}, DB: ${database}`);
      
      const pool = new Pool({
        user: decodeURIComponent(user),
        password: decodeURIComponent(password),
        host,
        port: parseInt(port, 10),
        database,
        max: 5,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
      });

      pool.on("error", (err) => console.error("[prisma] Pool Error:", err.message));

      const adapter = new PrismaPg(pool);
      return new PrismaClient({ adapter });
    } else {
      console.warn("[prisma] URL did not match regex, falling back to connectionString");
      const pool = new Pool({
        connectionString: url,
        max: 5,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
      });
      const adapter = new PrismaPg(pool);
      return new PrismaClient({ adapter });
    }
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
