import { db } from "@/backend/db";

// See prisma/schema.prisma's User.deletedAt comment and
// src/app/api/account/route.ts: account deletion is a soft delete (the
// session callback in auth.ts stops treating a deletedAt user as logged in
// immediately), but the row and its data are meant to survive a grace
// period before being actually removed — this is that removal. Every
// model's userId relation is onDelete: Cascade (verified directly in the
// schema, not assumed), so a single delete cascades PlanItem, WeeklyPlan,
// CheckIn, Recommendation, Notification, and Account rows at the database
// level — no manual per-table cleanup needed here.
const GRACE_PERIOD_DAYS = 30;

export async function runPurgeDeletedAccountsSweep(): Promise<{ purged: number }> {
  const threshold = new Date(Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  const { count } = await db.user.deleteMany({
    where: { deletedAt: { lte: threshold } },
  });

  return { purged: count };
}
