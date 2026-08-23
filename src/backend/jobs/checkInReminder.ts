import { db } from "@/backend/db";
import { sendEmail } from "@/backend/email";
import { ReminderEmail } from "@/backend/emails/ReminderEmail";
import { getCurrentWeekOf } from "@/backend/week";
import { activeOnboardedUsers, APP_URL } from "@/backend/jobs/shared";

const LOOKBACK_WEEKS = 8; // bounded catch-up window if the worker was down for a while

// See diagrams/check-in-flow.mmd: "Enqueue check-in reminder job" ->
// "Mark check-in as pending" -> "Send reminder". Runs frequently (see
// src/worker/scheduler.ts) so each user's own local week-boundary is caught
// promptly; idempotent via CheckIn's @@unique([userId, weekOf]) — safe to
// run more often than any single user actually crosses a boundary.
//
// Scans every recent week with plan items but no CheckIn yet, not just "one
// week back" — src/app/api/check-in/pending/route.ts already expects
// multiple pending check-ins can pile up if a user goes inactive for a
// while ("oldest pending first"), so the creation side needs to be able to
// catch up the same way rather than only ever noticing the most recent gap.
export async function runCheckInReminderSweep(): Promise<{ created: number }> {
  const users = await activeOnboardedUsers();
  let created = 0;

  for (const user of users) {
    if (!user.email) continue;

    const currentWeekOf = getCurrentWeekOf(user.weekStartDay, user.timezone);
    const earliestWeekOf = new Date(currentWeekOf);
    earliestWeekOf.setUTCDate(earliestWeekOf.getUTCDate() - LOOKBACK_WEEKS * 7);

    const pastWeeks = await db.planItem.findMany({
      where: { userId: user.id, weekOf: { gte: earliestWeekOf, lt: currentWeekOf } },
      select: { weekOf: true },
      distinct: ["weekOf"],
      orderBy: { weekOf: "asc" },
    });

    const newlyPending: Date[] = [];
    for (const { weekOf } of pastWeeks) {
      const existing = await db.checkIn.findUnique({
        where: { userId_weekOf: { userId: user.id, weekOf } },
      });
      if (existing) continue;

      const weeklyPlan = await db.weeklyPlan.findUnique({
        where: { userId_weekOf: { userId: user.id, weekOf } },
      });

      await db.$transaction([
        db.checkIn.create({
          data: { userId: user.id, weeklyPlanId: weeklyPlan?.id, weekOf, status: "PENDING" },
        }),
        db.notification.create({
          data: { userId: user.id, weeklyPlanId: weeklyPlan?.id, type: "CHECK_IN_REMINDER" },
        }),
      ]);

      newlyPending.push(weekOf);
    }

    if (newlyPending.length === 0) continue;

    // One email per user per sweep even if several weeks piled up at once
    // (e.g. after the worker was offline) — never send a burst of separate
    // reminder emails for the same catch-up.
    const subject =
      newlyPending.length === 1
        ? "Your weekly check-in is ready"
        : `You have ${newlyPending.length} weekly check-ins ready`;
    const body =
      newlyPending.length === 1
        ? "How'd last week go? Log in to check in on what happened."
        : `You have ${newlyPending.length} weeks to check in on. Log in to catch up, oldest first.`;
    await sendEmail({
      to: user.email,
      subject,
      text: `${body} ${APP_URL}/check-in`,
      react: ReminderEmail({
        preview: subject,
        heading: subject,
        body,
        ctaLabel: "Check in now",
        ctaHref: `${APP_URL}/check-in`,
      }),
    });

    created += newlyPending.length;
  }

  return { created };
}
