import { NextResponse } from "next/server";
import { db } from "@/backend/db";
import { requireUserId } from "@/backend/auth";

// Everything the user has ever put into (or that's been generated for)
// this account, in one file — password is deliberately excluded even
// hashed, since there's no legitimate reason for a data export to include
// credential material at all. weekOf/startTime/etc. are exported as real
// Date objects; JSON.stringify renders them as ISO strings, same as every
// API response elsewhere in this app.
export async function GET() {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const [user, weeklyPlans, planItems, checkIns, recommendations, notifications] =
    await Promise.all([
      db.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          timezone: true,
          weekStartDay: true,
          selectedCategories: true,
          onboarded: true,
          createdAt: true,
        },
      }),
      db.weeklyPlan.findMany({ where: { userId }, orderBy: { weekOf: "asc" } }),
      db.planItem.findMany({ where: { userId }, orderBy: { startTime: "asc" } }),
      db.checkIn.findMany({ where: { userId }, orderBy: { weekOf: "asc" } }),
      db.recommendation.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      db.notification.findMany({ where: { userId }, orderBy: { sentAt: "asc" } }),
    ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    user,
    weeklyPlans,
    planItems,
    checkIns,
    recommendations,
    notifications,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="balance-planner-export-${Date.now()}.json"`,
    },
  });
}
