import { redirect } from "next/navigation";
import { auth } from "@/backend/auth";
import { db } from "@/backend/db";
import { getCurrentWeekOf } from "@/backend/week";
import { LoginButtons } from "@/frontend/components/LoginButtons";
import { WeeklyPlanner } from "@/frontend/components/WeeklyPlanner";
import { PageShell } from "@/frontend/components/PageShell";

// Server Component — the gate sequence from diagrams/user-flow.mmd:
// session -> onboarding -> pending check-in -> planning view. Queries the
// DB directly rather than calling our own API routes over HTTP, which is
// the idiomatic Next.js pattern for a Server Component's own initial render
// (the API routes exist for client-side interactions, not for this).
export default async function HomePage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <PageShell title="Balance Planner">
        <LoginButtons />
      </PageShell>
    );
  }

  const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id } });

  if (!user.onboarded) {
    redirect("/onboarding");
  }

  const pendingCheckIn = await db.checkIn.findFirst({
    where: { userId: user.id, status: "PENDING" },
    orderBy: { weekOf: "asc" },
  });
  if (pendingCheckIn) {
    redirect("/check-in");
  }

  const weekOf = getCurrentWeekOf(user.weekStartDay, user.timezone);
  const weeklyPlan = await db.weeklyPlan.findUnique({
    where: { userId_weekOf: { userId: user.id, weekOf } },
    include: { planItems: true },
  });

  return (
    <PageShell title="This week">
      <WeeklyPlanner initialPlan={weeklyPlan} />
    </PageShell>
  );
}
