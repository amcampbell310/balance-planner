import Link from "next/link";
import { db } from "@/backend/db";
import { requireOnboardedUser } from "@/backend/gate";
import { getCurrentWeekPlan } from "@/backend/currentWeek";
import { PageShell } from "@/frontend/components/PageShell";
import { WeeklyPlanner } from "@/frontend/components/WeeklyPlanner";
import { CategoryBadge } from "@/frontend/components/CategoryBadge";

// The landing page — this week's plan front and center (the same
// WeeklyPlanner as /this-week, not a summary/teaser of it), plus a preview
// of recent recommendations, which otherwise only ever flash once on the
// check-in screen and are never seen again anywhere else in the app.
export default async function HomePage() {
  const user = await requireOnboardedUser();
  const [weeklyPlan, recommendations] = await Promise.all([
    getCurrentWeekPlan(user),
    db.recommendation.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  return (
    <PageShell title={`Welcome back${user.name ? `, ${user.name.split(" ")[0]}` : ""}`} wide>
      <div className="home-grid">
        <WeeklyPlanner initialPlan={weeklyPlan} />

        <aside className="stack">
          {recommendations.length > 0 && (
            <section className="stack">
              <h2>Recent suggestions</h2>
              <ul className="item-list">
                {recommendations.map((rec) => (
                  <li
                    key={rec.id}
                    className={rec.category ? `cat-${rec.category.toLowerCase()}` : ""}
                  >
                    <div className="item-row">
                      <span className="item-title">{rec.content}</span>
                      {rec.category && <CategoryBadge category={rec.category} />}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="muted">
            Looking for an older week? <Link href="/weeks">Browse past weeks</Link>.
          </p>
        </aside>
      </div>
    </PageShell>
  );
}
