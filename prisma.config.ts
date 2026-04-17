import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

// Match Next.js: `.env` then `.env.local` (local overrides).
loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

/** Prisma Migrate / CLI: prefer Neon direct URL when set (pooler URLs can break DDL). */
function migrateDatabaseUrl(): string {
  return process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrateDatabaseUrl(),
  },
});
