import { db } from "@/backend/db";
import type { User, WeeklyPlan, PlanItem } from "@prisma/client";

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
