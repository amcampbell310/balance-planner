import { redirect } from "next/navigation";
import { auth } from "@/backend/auth";
import { requireOnboardedUser } from "@/backend/gate";
import { LoginButtons } from "@/frontend/components/LoginButtons";

// Pure entry point: logged out -> login screen (no sidebar, no PageShell —
// this is a dedicated centered hero, not a normal app page). Logged in ->
// requireOnboardedUser() redirects to /onboarding or /check-in as needed,
// or falls through here once fully cleared, landing on /home (see
// src/app/(app)/home/page.tsx).
export default async function EntryPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="login-page">
        <div className="login-card">
          <h1>Balance Planner</h1>
          <p className="login-tagline">
            Plan your week without losing the parts that make it worth living.
          </p>
          <LoginButtons />
        </div>
      </main>
    );
  }

  await requireOnboardedUser();
  redirect("/home");
}
