import { NextResponse } from "next/server";
import { db } from "@/backend/db";
import { requireUserId } from "@/backend/auth";

// "Dismiss / continue" in check-in-flow.mmd — clears the pending gate so
// the next request for /api/check-in/pending returns null and the home
// screen stops being blocked.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;

  const checkIn = await db.checkIn.findUnique({ where: { id } });
  if (!checkIn || checkIn.userId !== userId) {
    return NextResponse.json({ error: "Check-in not found" }, { status: 404 });
  }

  const updated = await db.checkIn.update({
    where: { id },
    data: { status: "COMPLETED" },
  });

  return NextResponse.json(updated);
}
