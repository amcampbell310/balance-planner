import { requireOnboardedUser } from "@/backend/gate";
import { getCurrentWeekPlan } from "@/backend/currentWeek";
import { PageShell } from "@/frontend/components/PageShell";
import { WeeklyPlanner } from "@/frontend/components/WeeklyPlanner";

// Focused, single-purpose view of the current week — no dashboard chrome
// around it. See src/app/(app)/home/page.tsx for the same content embedded
// directly on the landing page.
export default async function ThisWeekPage() {
  const user = await requireOnboardedUser();
  const weeklyPlan = await getCurrentWeekPlan(user);

  return (
    <PageShell title="This week">
      <WeeklyPlanner initialPlan={weeklyPlan} />
    </PageShell>
  );
}
