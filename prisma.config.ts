// Prisma 7 config file — see https://pris.ly/d/config
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Used by `prisma migrate` / `prisma db push` and CLI operations.
    //
    // Supabase note: when running `npx prisma db push` against Supabase,
    // set DATABASE_URL to the DIRECT connection (port 5432, no pooler)
    // for the duration of that command — pgBouncer/transaction-mode
    // pooling breaks Prisma's introspection/migration path.
    // At runtime, the app uses whatever DATABASE_URL is set (pooled is fine).
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
