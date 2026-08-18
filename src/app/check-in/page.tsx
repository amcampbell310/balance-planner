import { redirect } from "next/navigation";
import { auth } from "@/backend/auth";
import { db } from "@/backend/db";
import { PageShell } from "@/frontend/components/PageShell";
import { CheckInScreen } from "@/frontend/components/CheckInScreen";

// The forced digest screen from diagrams/check-in-flow.mmd — reached only
// via the redirect in src/app/page.tsx when a pending check-in exists.
export default async function CheckInPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const checkIn = await db.checkIn.findFirst({
    where: { userId: session.user.id, status: "PENDING" },
    orderBy: { weekOf: "asc" },
  });
  if (!checkIn) {
    redirect("/");
  }

  const items = await db.planItem.findMany({
    where: { userId: session.user.id, weekOf: checkIn.weekOf },
    orderBy: { startTime: "asc" },
  });

  return (
    <PageShell title="How'd this week go?">
      <CheckInScreen checkIn={checkIn} items={items} />
    </PageShell>
  );
}
