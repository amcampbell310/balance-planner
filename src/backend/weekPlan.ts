import { db } from "@/backend/db";
import type { User, WeeklyPlan, PlanItem } from "@prisma/client";
import { getWeekOfForDate } from "@/backend/week";

// Works identically for the current week and any past week — the only
// thing that differs is which UI renders the result, not how it's fetched.
// Items are always queried directly by (userId, weekOf), never through
// WeeklyPlan's `planItems` relation: manually-created items deliberately
// leave `weeklyPlanId` unset (see src/app/api/plan-items/route.ts), so that
// relation silently excludes them. Querying PlanItem directly is the only
// way to get "everything scheduled this week," draft-derived or manual.
export async function getWeekData(
  user: User,
  weekOf: Date,
): Promise<{ weeklyPlan: WeeklyPlan | null; items: PlanItem[] }> {
  const [weeklyPlan, items] = await Promise.all([
    db.weeklyPlan.findUnique({ where: { userId_weekOf: { userId: user.id, weekOf } } }),
    db.planItem.findMany({
      where: { userId: user.id, weekOf },
      orderBy: { startTime: "asc" },
    }),
  ]);
  return { weeklyPlan, items };
}

// The earliest week the "previous week" arrow should ever be able to reach
// — the week the account was created in, or the week of the account's
// earliest real data if that somehow predates account creation (shouldn't
// happen under normal use, but a seeded/imported/edge-case row shouldn't
// become unreachable). Without this, a brand-new user could arrow back
// through years of empty, pre-account weeks for no reason — see
// home/page.tsx, where this bounds both the prev-arrow link and a direct
// ?week= URL below it.
export async function getEarliestNavigableWeekOf(user: User): Promise<Date> {
  const accountWeekOf = getWeekOfForDate(user.createdAt, user.weekStartDay, user.timezone);

  const earliestItem = await db.planItem.findFirst({
    where: { userId: user.id },
    orderBy: { weekOf: "asc" },
    select: { weekOf: true },
  });

  if (earliestItem && earliestItem.weekOf.getTime() < accountWeekOf.getTime()) {
    return earliestItem.weekOf;
  }
  return accountWeekOf;
}
