import { NextResponse } from "next/server";
import { db } from "@/backend/db";
import { requireUserId } from "@/backend/auth";
import { dayOfWeekToDate } from "@/backend/week";
import type { WeeklyDraft } from "@/backend/claude";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;

  const weeklyPlan = await db.weeklyPlan.findUnique({ where: { id } });
  if (!weeklyPlan) {
    return NextResponse.json({ error: "Weekly plan not found" }, { status: 404 });
  }
  // Previously missing entirely — anyone who knew a plan id could approve
  // it. Same 404 as "not found" rather than 403, so an attacker probing IDs
  // can't distinguish "doesn't exist" from "exists but isn't yours."
  if (weeklyPlan.userId !== userId) {
    return NextResponse.json({ error: "Weekly plan not found" }, { status: 404 });
  }
  if (weeklyPlan.status !== "PENDING") {
    return NextResponse.json({ error: `Plan is already ${weeklyPlan.status}` }, { status: 409 });
  }

  const user = await db.user.findUniqueOrThrow({ where: { id: weeklyPlan.userId } });
  const draft = weeklyPlan.draftJson as unknown as WeeklyDraft;

  await db.$transaction([
    db.planItem.createMany({
      data: draft.items.map((item) => ({
        userId: weeklyPlan.userId,
        weeklyPlanId: weeklyPlan.id,
        title: item.title,
        category: item.category,
        startTime: dayOfWeekToDate(
          weeklyPlan.weekOf,
          user.weekStartDay,
          item.dayOfWeek,
          item.startTime,
          user.timezone,
        ),
        endTime: dayOfWeekToDate(
          weeklyPlan.weekOf,
          user.weekStartDay,
          item.dayOfWeek,
          item.endTime,
          user.timezone,
        ),
        weekOf: weeklyPlan.weekOf,
        source: "CLAUDE_DRAFT",
      })),
    }),
    db.weeklyPlan.update({
      where: { id },
      data: { status: "APPROVED", approvedAt: new Date() },
    }),
  ]);

  const result = await db.weeklyPlan.findUnique({
    where: { id },
    include: { planItems: true },
  });

  return NextResponse.json(result);
}
