import { redirect } from "next/navigation";
import { auth } from "@/backend/auth";
import { db } from "@/backend/db";
import { PageShell } from "@/frontend/components/PageShell";
import { OnboardingForm } from "@/frontend/components/OnboardingForm";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (user.onboarded) {
    redirect("/");
  }

  return (
    <PageShell title="Set up your week">
      <OnboardingForm />
    </PageShell>
  );
}
