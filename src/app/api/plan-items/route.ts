import { NextRequest, NextResponse } from "next/server";
import { Category } from "@prisma/client";
import { db } from "@/backend/db";
import { requireUserId } from "@/backend/auth";
import { getCurrentWeekOf, getWeekOfForDate } from "@/backend/week";

export async function GET(request: NextRequest) {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });

  // Optional override — defaults to the user's current week.
  const weekOfParam = request.nextUrl.searchParams.get("weekOf");
  const weekOf = weekOfParam
    ? new Date(weekOfParam)
    : getCurrentWeekOf(user.weekStartDay, user.timezone);

  const items = await db.planItem.findMany({
    where: { userId, weekOf },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json({ items });
}

// Manual item entry — see diagrams/onboarding-flow.mmd decision that not
// every item has to come from a Claude-generated draft. weeklyPlanId is
// intentionally left unset here (PlanItem.weeklyPlanId is optional).
export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const { title, category, startTime, endTime } = body as {
    title?: string;
    category?: string;
    startTime?: string;
    endTime?: string;
  };

  if (!title || !category || !startTime || !endTime) {
    return NextResponse.json(
      { error: "title, category, startTime, and endTime are required" },
      { status: 400 },
    );
  }

  if (!Object.values(Category).includes(category as Category)) {
    return NextResponse.json({ error: `Invalid category: ${category}` }, { status: 400 });
  }

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json(
      { error: "startTime and endTime must be valid ISO date strings" },
      { status: 400 },
    );
  }

  const item = await db.planItem.create({
    data: {
      userId,
      title,
      category: category as Category,
      startTime: start,
      endTime: end,
      weekOf: getWeekOfForDate(start, user.weekStartDay, user.timezone),
      source: "MANUAL",
    },
  });

  return NextResponse.json(item, { status: 201 });
}
