import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Lazy PrismaClient
 * -----------------
 * Next.js `next build` runs a "Collect page data" pass that imports every
 * route/server-action module. If Prisma is instantiated at module-load
 * time (top-level `new PrismaClient(...)`), that pass crashes with
 * "DATABASE_URL is not set" whenever the env isn't populated during CI
 * builds (GitHub Actions, Vercel, Emergent, Hostinger, etc.).
 *
 * Solution: wrap the client in a lazy Proxy. Nothing touches Postgres
 * until code actually reads a property (e.g. `prisma.user.findFirst()`).
 * At that point DATABASE_URL is always present because we're inside a
 * runtime request, not a build-time analysis pass.
 */

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Populate it in .env (dev) or in your deploy secrets (prod)."
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/**
 * Proxy that instantiates the real PrismaClient on first property access.
 * `next build` never triggers that access, so the build stays green.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value;
  },
});
