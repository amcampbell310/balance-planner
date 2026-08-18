import { redirect } from "next/navigation";
import { auth } from "@/backend/auth";
import { db } from "@/backend/db";
import type { User } from "@prisma/client";

// The gate sequence from diagrams/user-flow.mmd: session -> onboarding ->
// pending check-in -> the real app. Shared by both src/app/page.tsx (the
// login/redirect resolver) and src/app/(app)/layout.tsx (so directly
// visiting /home, /this-week, or /weeks by URL is gated the same way, not
// just relying on / to have funneled the user through first).
export async function requireOnboardedUser(): Promise<User> {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (!user.onboarded) redirect("/onboarding");

  const pendingCheckIn = await db.checkIn.findFirst({
    where: { userId: user.id, status: "PENDING" },
    orderBy: { weekOf: "asc" },
  });
  if (pendingCheckIn) redirect("/check-in");

  return user;
}
