import Link from "next/link";
import { db } from "@/backend/db";
import { requireOnboardedUser } from "@/backend/gate";
import { getCurrentWeekOf, weekOfToParam } from "@/backend/week";
import { PageShell } from "@/frontend/components/PageShell";

export default async function PastWeeksPage() {
  const user = await requireOnboardedUser();
  const currentWeekOf = getCurrentWeekOf(user.weekStartDay, user.timezone);

  // Any week the user had activity in, not just ones with a completed
  // check-in — a manual-only week with no WeeklyPlan/CheckIn yet should
  // still show up here rather than silently disappearing.
  const weekRows = await db.planItem.findMany({
    where: { userId: user.id, weekOf: { lt: currentWeekOf } },
    select: { weekOf: true },
    distinct: ["weekOf"],
    orderBy: { weekOf: "desc" },
  });

  const checkIns = await db.checkIn.findMany({
    where: { userId: user.id, weekOf: { lt: currentWeekOf } },
  });
  const statusByWeek = new Map(checkIns.map((c) => [c.weekOf.toISOString(), c.status]));

  return (
    <PageShell title="Past weeks">
      {weekRows.length === 0 ? (
        <p className="muted">No past weeks yet — they'll show up here once this week wraps.</p>
      ) : (
        <ul className="item-list">
          {weekRows.map((row) => {
            const status = statusByWeek.get(row.weekOf.toISOString()) ?? "NO CHECK-IN";
            return (
              <li key={row.weekOf.toISOString()}>
                <div className="item-row">
                  <Link href={`/home?week=${weekOfToParam(row.weekOf)}`} className="item-title">
                    Week of {row.weekOf.toLocaleDateString()}
                  </Link>
                  <span className="muted">{status}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
