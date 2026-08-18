import { redirect } from "next/navigation";
import { auth } from "@/backend/auth";
import { requireOnboardedUser } from "@/backend/gate";
import { LoginButtons } from "@/frontend/components/LoginButtons";
import { PageShell } from "@/frontend/components/PageShell";

// Pure entry point: logged out -> login screen (no sidebar — this isn't
// part of the app shell yet). Logged in -> requireOnboardedUser() redirects
// to /onboarding or /check-in as needed, or falls through here once fully
// cleared, landing on /home (see src/app/(app)/home/page.tsx).
export default async function EntryPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <PageShell title="Balance Planner">
        <LoginButtons />
      </PageShell>
    );
  }

  await requireOnboardedUser();
  redirect("/home");
}
