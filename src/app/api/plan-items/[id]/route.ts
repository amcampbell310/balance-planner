import { NextResponse } from "next/server";
import { PlanItemStatus } from "@prisma/client";
import { db } from "@/backend/db";
import { requireUserId } from "@/backend/auth";

// Marks an item done/missed/skipped, with an optional note on why — see
// diagrams/check-in-flow.mmd ("Mark items done / missed") and the
// statusNote field added specifically to feed the recommendation engine.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;

  const existing = await db.planItem.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Plan item not found" }, { status: 404 });
  }

  const body = await request.json();
  const { status, statusNote } = body as { status?: string; statusNote?: string | null };

  if (!status || !Object.values(PlanItemStatus).includes(status as PlanItemStatus)) {
    return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
  }

  const data: { status: PlanItemStatus; statusNote?: string | null } = {
    status: status as PlanItemStatus,
  };
  // Only touch statusNote if the caller actually sent it — omitting the key
  // should leave an existing note alone, not silently clear it.
  if ("statusNote" in body) {
    data.statusNote = statusNote ?? null;
  }

  const item = await db.planItem.update({ where: { id }, data });

  return NextResponse.json(item);
}
