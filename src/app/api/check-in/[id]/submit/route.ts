import { NextResponse } from "next/server";
import { PlanItemStatus } from "@prisma/client";
import { db } from "@/backend/db";
import { requireUserId } from "@/backend/auth";
import { generateMissedItemSuggestion } from "@/backend/claude";
import { MIN_WEEKS_FOR_PERSONALIZATION } from "@/backend/jobs/shared";

// Static, not Claude-generated — that's the point of "generic": no LLM call
// until there's enough history to actually personalize. See
// diagrams/data-flow.mmd's GenericRec node.
const GENERIC_TIPS: Record<string, string> = {
  WORK: "Block focus time on your calendar before the week fills up with meetings.",
  SOCIAL: "Put social plans on the calendar early in the week, not as an afterthought on Friday.",
  GAMING:
    'Treat gaming time like any other commitment — pick a specific day and time, not "whenever."',
  FITNESS: "Pairing a workout with an existing habit makes it easier to actually stick to it.",
  CHORES: "Small chores done right when they come up tend to stick better than batching them.",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;
  const body = await request.json();
  const { items } = body as {
    items?: Array<{ planItemId: string; status: string; statusNote?: string | null }>;
  };

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "items is required" }, { status: 400 });
  }
  for (const item of items) {
    if (!Object.values(PlanItemStatus).includes(item.status as PlanItemStatus)) {
      return NextResponse.json(
        { error: `Invalid status "${item.status}" for item ${item.planItemId}` },
        { status: 400 },
      );
    }
  }

  const checkIn = await db.checkIn.findUnique({ where: { id } });
  if (!checkIn || checkIn.userId !== userId) {
    return NextResponse.json({ error: "Check-in not found" }, { status: 404 });
  }
  if (checkIn.status !== "PENDING") {
    return NextResponse.json({ error: `Check-in is already ${checkIn.status}` }, { status: 409 });
  }

  // Every referenced plan item must actually belong to this user — without
  // this check, a submitted id for someone else's item would silently
  // update it (Prisma's update-by-id doesn't check ownership on its own).
  const referencedIds = items.map((i) => i.planItemId);
  const ownedItems = await db.planItem.findMany({
    where: { id: { in: referencedIds }, userId },
    select: { id: true },
  });
  const ownedIds = new Set(ownedItems.map((i) => i.id));
  const notOwned = referencedIds.filter((itemId) => !ownedIds.has(itemId));
  if (notOwned.length > 0) {
    return NextResponse.json(
      { error: `Plan item(s) not found: ${notOwned.join(", ")}` },
      { status: 404 },
    );
  }

  // Record what happened per item.
  await Promise.all(
    items.map((item) =>
      db.planItem.update({
        where: { id: item.planItemId },
        data: {
          status: item.status as PlanItemStatus,
          statusNote: item.statusNote ?? null,
        },
      }),
    ),
  );

  await db.checkIn.update({ where: { id }, data: { respondedAt: new Date() } });

  // Weeks of feedback collected BEFORE this submission — i.e. is there
  // already enough history to personalize, not counting what we just did.
  const weeksOfData = await db.checkIn.count({
    where: { userId: checkIn.userId, status: "COMPLETED" },
  });
  const sufficientData = weeksOfData >= MIN_WEEKS_FOR_PERSONALIZATION;

  const missedItems = await db.planItem.findMany({
    where: { id: { in: referencedIds }, status: "MISSED" },
  });

  if (missedItems.length === 0) {
    return NextResponse.json({
      checkIn,
      weeksOfData,
      sufficientData,
      missedItems,
      recommendation: null,
    });
  }

  if (!sufficientData) {
    const target = missedItems[0];
    const recommendation = await db.recommendation.create({
      data: {
        userId: checkIn.userId,
        weeklyPlanId: checkIn.weeklyPlanId,
        planItemId: target.id,
        type: "WEEKLY_SUGGESTION",
        category: target.category,
        content:
          GENERIC_TIPS[target.category] ??
          "Keep going — check back in a few weeks for suggestions tailored to your patterns.",
        isGeneric: true,
      },
    });
    return NextResponse.json({ checkIn, weeksOfData, sufficientData, missedItems, recommendation });
  }

  // Only the first missed item gets a suggestion this pass — see
  // diagrams/check-in-flow.mmd's singular framing ("Move gym to mornings
  // next week?"). Multiple simultaneous suggestions can come later.
  const target = missedItems[0];

  const pastItems = await db.planItem.findMany({
    where: {
      userId: checkIn.userId,
      category: target.category,
      weekOf: { lt: checkIn.weekOf },
    },
    orderBy: { weekOf: "desc" },
    take: 20,
  });
  const pastPatterns =
    pastItems.length > 0
      ? pastItems.map((p) => `${p.title} (${p.status})`).join("; ")
      : "No prior history in this category.";

  const suggestion = await generateMissedItemSuggestion({
    missedItem: {
      title: target.title,
      category: target.category,
      statusNote: target.statusNote,
    },
    pastPatterns,
  });

  const recommendation = await db.recommendation.create({
    data: {
      userId: checkIn.userId,
      weeklyPlanId: checkIn.weeklyPlanId,
      planItemId: target.id,
      type: "WEEKLY_SUGGESTION",
      category: target.category,
      content: suggestion.suggestion,
      isGeneric: false,
    },
  });

  return NextResponse.json({
    checkIn,
    weeksOfData,
    sufficientData,
    missedItems,
    recommendation,
  });
}
