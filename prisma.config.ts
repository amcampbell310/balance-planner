import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Read by the Prisma CLI (generate, migrate, studio) — separate from how
// PrismaClient connects at runtime (see src/backend/db.ts, which uses the
// @prisma/adapter-pg driver adapter directly).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
