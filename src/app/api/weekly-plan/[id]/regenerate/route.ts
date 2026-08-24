import { NextResponse } from "next/server";
import { db } from "@/backend/db";
import { requireUserId } from "@/backend/auth";
import { generateWeeklyDraft } from "@/backend/claude";
import { dateToDayOfWeek, formatHHMM } from "@/backend/week";

// Real billing is live and, unlike initial draft creation (capped to
// once/week by WeeklyPlan's own @@unique constraint), regenerate has no
// natural limit — it's meant to be clickable repeatedly until the user is
// happy with a draft. This caps it server-side rather than trusting the
// frontend alone to behave.
const MAX_REGENERATIONS = 5;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;
  const body = await request.json();
  const { adjustment } = body as { adjustment?: string };

  if (!adjustment) {
    return NextResponse.json({ error: "adjustment is required" }, { status: 400 });
  }

  const weeklyPlan = await db.weeklyPlan.findUnique({ where: { id } });
  if (!weeklyPlan || weeklyPlan.userId !== userId) {
    return NextResponse.json({ error: "Weekly plan not found" }, { status: 404 });
  }
  if (weeklyPlan.status !== "PENDING") {
    return NextResponse.json(
      { error: `Cannot regenerate a plan that is already ${weeklyPlan.status}` },
      { status: 409 },
    );
  }
  if (weeklyPlan.regenerateCount >= MAX_REGENERATIONS) {
    return NextResponse.json(
      {
        error: `This draft has been regenerated ${MAX_REGENERATIONS} times already — approve it or start fresh next week.`,
      },
      { status: 429 },
    );
  }

  const user = await db.user.findUniqueOrThrow({ where: { id: weeklyPlan.userId } });

  const existingItems = await db.planItem.findMany({
    where: { userId: weeklyPlan.userId, weekOf: weeklyPlan.weekOf },
  });

  const draft = await generateWeeklyDraft({
    existingItems: existingItems.map((item) => ({
      title: item.title,
      category: item.category,
      dayOfWeek: dateToDayOfWeek(item.startTime, user.timezone),
      startTime: formatHHMM(item.startTime, user.timezone),
      endTime: formatHHMM(item.endTime, user.timezone),
    })),
    priorities: `${weeklyPlan.priorities}\n\nAdjustment requested: ${adjustment}`,
    selectedCategories: user.selectedCategories,
  });

  const updated = await db.weeklyPlan.update({
    where: { id },
    data: { draftJson: draft, regenerateCount: { increment: 1 } },
  });

  return NextResponse.json(updated);
}
