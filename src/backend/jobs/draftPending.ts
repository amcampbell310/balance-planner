import { db } from "@/backend/db";
import { sendEmail } from "@/backend/email";
import { ReminderEmail } from "@/backend/emails/ReminderEmail";
import { hasRecentNotification, APP_URL } from "@/backend/jobs/shared";

// See prisma/schema.prisma's NotificationType comment: fires at most once
// per WeeklyPlan (never repeats for the same draft), and is held off if the
// user got ANY notification in the last 7 days.
export async function runDraftPendingSweep(): Promise<{ sent: number }> {
  const pendingPlans = await db.weeklyPlan.findMany({
    where: { status: "PENDING", user: { deletedAt: null } },
    include: { user: true },
  });

  let sent = 0;

  for (const plan of pendingPlans) {
    if (!plan.user.email) continue;

    const alreadyNotified = await db.notification.findFirst({
      where: { weeklyPlanId: plan.id, type: "DRAFT_PENDING" },
    });
    if (alreadyNotified) continue;

    if (await hasRecentNotification(plan.userId, 7)) continue;

    await db.notification.create({
      data: { userId: plan.userId, weeklyPlanId: plan.id, type: "DRAFT_PENDING" },
    });

    const subject = "Your weekly draft is waiting for you";
    const body = "Claude drafted a plan for this week that's still waiting on your approval.";
    await sendEmail({
      to: plan.user.email,
      subject,
      text: `${body} ${APP_URL}/home`,
      react: ReminderEmail({
        preview: subject,
        heading: subject,
        body,
        ctaLabel: "Review the draft",
        ctaHref: `${APP_URL}/home`,
      }),
    });

    sent += 1;
  }

  return { sent };
}
