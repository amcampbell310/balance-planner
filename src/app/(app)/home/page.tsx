import { db } from "@/backend/db";
import { requireOnboardedUser } from "@/backend/gate";
import { getWeekData } from "@/backend/weekPlan";
import { addWeeks, getCurrentWeekOf, snapParamToWeekOf, weekOfToParam } from "@/backend/week";
import { PageShell } from "@/frontend/components/PageShell";
import { WeeklyPlanner } from "@/frontend/components/WeeklyPlanner";
import { WeekPicker } from "@/frontend/components/WeekNav";
import { CategoryLegend } from "@/frontend/components/CategoryLegend";
import { CalendarWeekView } from "@/frontend/components/CalendarWeekView";
import { normalizePlanItems } from "@/frontend/calendarTypes";

// The landing page — and the calendar for any week, current or past, via
// ?week=YYYY-MM-DD. The current week gets the full interactive WeeklyPlanner
// (draft/approve/manual-add); any other week is a simpler read-only render,
// since past weeks are always already-resolved history (never a pending
// draft) — see documents/roadmap.md's "Home as a real calendar view" entry
// for why this exists.
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const user = await requireOnboardedUser();
  const { week } = await searchParams;
  const currentWeekOf = getCurrentWeekOf(user.weekStartDay, user.timezone);

  // Never trust the raw param as already week-aligned — a hand-edited URL,
  // an old link from before a weekStartDay change, or a bad date all need
  // to snap to a real week start rather than break column alignment.
  let weekOf = currentWeekOf;
  if (week) {
    const parsed = new Date(`${week}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) {
      weekOf = snapParamToWeekOf(parsed, user.weekStartDay);
    }
  }

  const isCurrentWeek = weekOf.getTime() === currentWeekOf.getTime();
  const { weeklyPlan, items } = await getWeekData(user, weekOf);

  const prevHref = `/home?week=${weekOfToParam(addWeeks(weekOf, -1))}`;
  const nextHref = isCurrentWeek ? null : `/home?week=${weekOfToParam(addWeeks(weekOf, 1))}`;

  if (isCurrentWeek) {
    const [recommendations, previousWeek] = await Promise.all([
      db.recommendation.findMany({
        where: { userId: user.id, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      // Only meaningful before a plan exists (the "same as last week?"
      // prompt only makes sense at the very start of a new week) — fetched
      // unconditionally anyway since it's one cheap indexed query either
      // way, avoiding a second conditional data-fetch shape here.
      getWeekData(user, addWeeks(weekOf, -1)),
    ]);

    return (
      <PageShell
        title={`Welcome back${user.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        wide
        centerTitle
      >
        <WeeklyPlanner
          initialPlan={weeklyPlan}
          initialItems={items}
          previousWeekItems={previousWeek.items}
          weekOf={weekOf}
          weekStartDay={user.weekStartDay}
          timezone={user.timezone}
          selectedCategories={user.selectedCategories}
          recommendations={recommendations}
          prevHref={prevHref}
          nextHref={nextHref}
        />
      </PageShell>
    );
  }

  // Past week — read-only, no draft/approve/manual-add.
  const checkIn = await db.checkIn.findUnique({
    where: { userId_weekOf: { userId: user.id, weekOf } },
  });

  return (
    <PageShell
      title={`Week of ${weekOf.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`}
      wide
      centerTitle
    >
      <div className="stack">
        <div className="week-header">
          <WeekPicker
            weekOf={weekOf}
            prevHref={prevHref}
            nextHref={nextHref}
            status={checkIn ? `Check-in: ${checkIn.status}` : undefined}
          />
          <CategoryLegend />
        </div>
        <CalendarWeekView
          weekOf={weekOf}
          weekStartDay={user.weekStartDay}
          entries={normalizePlanItems(items, user.timezone)}
          interactive={false}
        />
      </div>
    </PageShell>
  );
}
