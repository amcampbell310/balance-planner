import { db } from "@/backend/db";

// Shared with src/app/api/check-in/[id]/submit/route.ts — "2-4+ weeks of
// data" per prisma/schema.prisma's Recommendation comment; middle of that
// range, one constant so the check-in and trend-refresh paths can't drift.
export const MIN_WEEKS_FOR_PERSONALIZATION = 3;

// Anti-spam rule from prisma/schema.prisma's NotificationType comment:
// before sending DRAFT_PENDING or RE_ENGAGEMENT, hold off if this user got
// ANY notification (of any type) in the last N days. CHECK_IN_REMINDER is
// the core loop and is exempt — it always fires on schedule.
export async function hasRecentNotification(userId: string, sinceDays: number): Promise<boolean> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const recent = await db.notification.findFirst({
    where: { userId, sentAt: { gte: since } },
  });
  return recent !== null;
}

export function activeOnboardedUsers() {
  return db.user.findMany({ where: { deletedAt: null, onboarded: true } });
}
