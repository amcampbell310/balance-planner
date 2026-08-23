import { db } from "@/backend/db";
import { sendEmail } from "@/backend/email";
import { ReminderEmail } from "@/backend/emails/ReminderEmail";
import { activeOnboardedUsers, hasRecentNotification, APP_URL } from "@/backend/jobs/shared";

const INACTIVITY_THRESHOLD_DAYS = 14;
const RE_ENGAGEMENT_SUPPRESSION_DAYS = 30;

// See prisma/schema.prisma's NotificationType comment: fires after ~14 days
// of inactivity, then is suppressed for 30 days before it can fire again —
// on top of the general "any notification in the last 7 days" throttle.
export async function runInactivitySweep(): Promise<{ sent: number }> {
  const users = await activeOnboardedUsers();
  const threshold = new Date(Date.now() - INACTIVITY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

  let sent = 0;

  for (const user of users) {
    if (!user.email) continue;
    const inactive = !user.lastLoginAt || user.lastLoginAt <= threshold;
    if (!inactive) continue;

    const recentReEngagement = await db.notification.findFirst({
      where: {
        userId: user.id,
        type: "RE_ENGAGEMENT",
        sentAt: { gte: new Date(Date.now() - RE_ENGAGEMENT_SUPPRESSION_DAYS * 24 * 60 * 60 * 1000) },
      },
    });
    if (recentReEngagement) continue;

    if (await hasRecentNotification(user.id, 7)) continue;

    await db.notification.create({
      data: { userId: user.id, type: "RE_ENGAGEMENT" },
    });

    const subject = "Your week is waiting";
    const body = "It's been a while since you planned a week with Balance Planner.";
    await sendEmail({
      to: user.email,
      subject,
      text: `${body} ${APP_URL}/home`,
      react: ReminderEmail({
        preview: subject,
        heading: subject,
        body,
        ctaLabel: "Pick it back up",
        ctaHref: `${APP_URL}/home`,
      }),
    });

    sent += 1;
  }

  return { sent };
}
