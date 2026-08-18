import { NextRequest, NextResponse } from "next/server";
import { Category } from "@prisma/client";
import { db } from "@/backend/db";
import { requireUserId } from "@/backend/auth";

// See diagrams/onboarding-flow.mmd: a curated set of categories (not
// unlimited custom options), plus timezone + week-start day, which the
// per-user Scheduler will read once it exists.
export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const { selectedCategories, timezone, weekStartDay } = body as {
    selectedCategories?: string[];
    timezone?: string;
    weekStartDay?: number;
  };

  if (!selectedCategories?.length || !timezone || weekStartDay === undefined) {
    return NextResponse.json(
      { error: "selectedCategories, timezone, and weekStartDay are required" },
      { status: 400 },
    );
  }

  const invalid = selectedCategories.filter(
    (c) => !Object.values(Category).includes(c as Category),
  );
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Invalid categories: ${invalid.join(", ")}` }, { status: 400 });
  }

  if (!Number.isInteger(weekStartDay) || weekStartDay < 0 || weekStartDay > 6) {
    return NextResponse.json(
      { error: "weekStartDay must be an integer between 0 (Sunday) and 6 (Saturday)" },
      { status: 400 },
    );
  }

  // lastLoginAt is already touched by requireUserId() above — no need to
  // set it again here.
  const user = await db.user.update({
    where: { id: userId },
    data: {
      selectedCategories: selectedCategories as Category[],
      timezone,
      weekStartDay,
      onboarded: true,
    },
  });

  return NextResponse.json(user);
}
