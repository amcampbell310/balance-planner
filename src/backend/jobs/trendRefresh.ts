import { db } from "@/backend/db";
import { analyzeTrends } from "@/backend/claude";
import { dateToDayOfWeek } from "@/backend/week";
import { activeOnboardedUsers, MIN_WEEKS_FOR_PERSONALIZATION } from "@/backend/jobs/shared";

const REFRESH_INTERVAL_DAYS = 14; // middle of the "every 2-4 weeks" spec
const LOOKBACK_WEEKS = 16; // bounded history window — see claude.ts's analyzeTrends comment

// See diagrams/architecture.mmd's Recommendation Engine / diagrams/data-flow.mmd's
// "enqueue: trend refresh, every 2-4 weeks". Runs as a daily sweep (see
// src/worker/scheduler.ts) that decides per-user whether a refresh is
// actually due, rather than one job per user on its own cadence.
export async function runTrendRefreshSweep(): Promise<{ refreshed: number }> {
  const users = await activeOnboardedUsers();
  let refreshed = 0;

  for (const user of users) {
    const completedCheckIns = await db.checkIn.count({
      where: { userId: user.id, status: "COMPLETED" },
    });
    if (completedCheckIns < MIN_WEEKS_FOR_PERSONALIZATION) continue;

    const lastInsight = await db.recommendation.findFirst({
      where: { userId: user.id, type: "PATTERN_INSIGHT" },
      orderBy: { createdAt: "desc" },
    });
    const dueThreshold = new Date(Date.now() - REFRESH_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
    if (lastInsight && lastInsight.createdAt > dueThreshold) continue;

    const since = new Date(Date.now() - LOOKBACK_WEEKS * 7 * 24 * 60 * 60 * 1000);
    const historyItems = await db.planItem.findMany({
      where: { userId: user.id, weekOf: { gte: since }, status: { not: "PLANNED" } },
      orderBy: { weekOf: "desc" },
    });
    if (historyItems.length === 0) continue;

    const insight = await analyzeTrends({
      historyItems: historyItems.map((item) => ({
        title: item.title,
        category: item.category,
        weekOf: item.weekOf.toISOString().slice(0, 10),
        dayOfWeek: dateToDayOfWeek(item.startTime, user.timezone),
        status: item.status,
        statusNote: item.statusNote,
      })),
    });

    await db.recommendation.create({
      data: {
        userId: user.id,
        type: "PATTERN_INSIGHT",
        category: insight.category,
        content: insight.insight,
        isGeneric: false,
      },
    });

    refreshed += 1;
  }

  return { refreshed };
}
