import "dotenv/config";
import { defineConfig } from "prisma/config";

// Read by the Prisma CLI (generate, migrate, studio) — separate from how
// PrismaClient connects at runtime (see src/backend/db.ts, which uses the
// @prisma/adapter-pg driver adapter directly, and always uses DATABASE_URL).
//
// This datasource.url deliberately points at DIRECT_URL, not DATABASE_URL,
// falling back to DATABASE_URL when DIRECT_URL isn't set (true for local
// dev, where they're the same plain Postgres connection anyway). Against
// Supabase's pooler in production the two differ: DATABASE_URL is the
// transaction-mode pooled connection the app should use at runtime, while
// DIRECT_URL is the session-mode connection migrations actually need —
// PgBouncer's transaction mode doesn't support what `prisma migrate`
// requires. Prisma 7's config schema (@prisma/config's `env()` helper takes
// no default/fallback parameter) has no separate directUrl field the way
// schema.prisma's datasource block used to, hence the plain process.env
// fallback here instead.
const directUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: directUrl,
  },
});
