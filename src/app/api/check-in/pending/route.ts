import { NextResponse } from "next/server";
import { db } from "@/backend/db";
import { requireUserId } from "@/backend/auth";

// CheckIn rows are created by the Scheduler worker (not built yet — see
// diagrams/check-in-flow.mmd), not by any user-facing route. Until that
// worker exists, seed a PENDING CheckIn via `npm run prisma:studio` to
// exercise this route.
export async function GET() {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  // Oldest pending first, in case a user skipped logging in for more than
  // one week and several check-ins piled up.
  const checkIn = await db.checkIn.findFirst({
    where: { userId, status: "PENDING" },
    orderBy: { weekOf: "asc" },
    include: { weeklyPlan: true },
  });

  return NextResponse.json({ checkIn });
}
