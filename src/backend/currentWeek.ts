import { db } from "@/backend/db";
import { getCurrentWeekOf } from "@/backend/week";
import type { User } from "@prisma/client";

// Shared by src/app/(app)/home/page.tsx and src/app/(app)/this-week/page.tsx
// — both render the same WeeklyPlanner for the same week, just with
// different surrounding page chrome.
export async function getCurrentWeekPlan(user: User) {
  const weekOf = getCurrentWeekOf(user.weekStartDay, user.timezone);
  return db.weeklyPlan.findUnique({
    where: { userId_weekOf: { userId: user.id, weekOf } },
    include: { planItems: true },
  });
}
