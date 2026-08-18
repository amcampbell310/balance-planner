import { NextRequest, NextResponse } from "next/server";
import { db } from "@/backend/db";
import { requireUserId } from "@/backend/auth";
import { generateWeeklyDraft } from "@/backend/claude";
import { getCurrentWeekOf, dateToDayOfWeek, formatHHMM } from "@/backend/week";

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const { priorities } = body as { priorities?: string };

  if (!priorities) {
    return NextResponse.json({ error: "priorities is required" }, { status: 400 });
  }

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const weekOf = getCurrentWeekOf(user.weekStartDay, user.timezone);

  // Respects the @@unique([userId, weekOf]) constraint — see user-flow.mmd,
  // this is exactly the check that route added when we found the diagram
  // would otherwise violate it.
  const existing = await db.weeklyPlan.findUnique({
    where: { userId_weekOf: { userId, weekOf } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A plan already exists for this week", weeklyPlanId: existing.id },
      { status: 409 },
    );
  }

  const existingItems = await db.planItem.findMany({ where: { userId, weekOf } });

  const draft = await generateWeeklyDraft({
    existingItems: existingItems.map((item) => ({
      title: item.title,
      category: item.category,
      dayOfWeek: dateToDayOfWeek(item.startTime, user.timezone),
      startTime: formatHHMM(item.startTime, user.timezone),
      endTime: formatHHMM(item.endTime, user.timezone),
    })),
    priorities,
    selectedCategories: user.selectedCategories,
  });

  const weeklyPlan = await db.weeklyPlan.create({
    data: {
      userId,
      weekOf,
      priorities,
      draftJson: draft,
      status: "PENDING",
    },
  });

  return NextResponse.json(weeklyPlan, { status: 201 });
}
