import type { ReactNode } from "react";
import { requireOnboardedUser } from "@/backend/gate";
import { Sidebar } from "@/frontend/components/Sidebar";

// Shared shell for the real app screens (Home, This Week, Past Weeks) —
// gates the same way as src/app/page.tsx so a direct URL visit is safe,
// then wraps everything in the sidebar. The forced check-in screen and
// onboarding deliberately stay outside this group — no sidebar there,
// matching their "blocks the rest of the app" intent from
// diagrams/check-in-flow.mmd and diagrams/onboarding-flow.mmd.
export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireOnboardedUser();

  return (
    <>
      <Sidebar />
      <div className="app-main">{children}</div>
    </>
  );
}
