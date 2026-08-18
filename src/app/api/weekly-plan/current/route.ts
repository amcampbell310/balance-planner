import { NextResponse } from "next/server";
import { db } from "@/backend/db";
import { requireUserId } from "@/backend/auth";
import { getCurrentWeekOf } from "@/backend/week";

export async function GET() {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const weekOf = getCurrentWeekOf(user.weekStartDay, user.timezone);

  const weeklyPlan = await db.weeklyPlan.findUnique({
    where: { userId_weekOf: { userId, weekOf } },
    include: { planItems: true },
  });

  // null is a valid, expected response — "no draft yet this week" per
  // user-flow.mmd, not an error.
  return NextResponse.json({ weeklyPlan });
}
