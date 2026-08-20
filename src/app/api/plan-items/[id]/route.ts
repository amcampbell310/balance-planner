import { NextResponse } from "next/server";
import { PlanItemStatus } from "@prisma/client";
import { db } from "@/backend/db";
import { requireUserId } from "@/backend/auth";
import { getCurrentWeekOf } from "@/backend/week";

// Marks an item done/missed/skipped, with an optional note on why — see
// diagrams/check-in-flow.mmd ("Mark items done / missed") and the
// statusNote field added specifically to feed the recommendation engine.
// Also updates startTime/endTime — added for the calendar's drag-to-resize
// (src/frontend/components/CalendarWeekView.tsx). Deliberately does NOT
// recompute weekOf: resizing (or moving to a different day) is out of
// scope here, this only ever adjusts times within the same day.
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
  const { status, statusNote, startTime, endTime } = body as {
    status?: string;
    statusNote?: string | null;
    startTime?: string;
    endTime?: string;
  };

  if (status === undefined && startTime === undefined && endTime === undefined) {
    return NextResponse.json(
      { error: "At least one of status, startTime, or endTime is required" },
      { status: 400 },
    );
  }

  const data: {
    status?: PlanItemStatus;
    statusNote?: string | null;
    startTime?: Date;
    endTime?: Date;
  } = {};

  if (status !== undefined) {
    if (!Object.values(PlanItemStatus).includes(status as PlanItemStatus)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }
    data.status = status as PlanItemStatus;
    // Only touch statusNote if the caller actually sent it — omitting the
    // key should leave an existing note alone, not silently clear it.
    if ("statusNote" in body) {
      data.statusNote = statusNote ?? null;
    }
  }

  if (startTime !== undefined || endTime !== undefined) {
    const newStart = startTime !== undefined ? new Date(startTime) : existing.startTime;
    const newEnd = endTime !== undefined ? new Date(endTime) : existing.endTime;
    if (Number.isNaN(newStart.getTime()) || Number.isNaN(newEnd.getTime())) {
      return NextResponse.json(
        { error: "startTime and endTime must be valid ISO date strings" },
        { status: 400 },
      );
    }
    if (newEnd <= newStart) {
      return NextResponse.json({ error: "endTime must be after startTime" }, { status: 400 });
    }
    if (startTime !== undefined) data.startTime = newStart;
    if (endTime !== undefined) data.endTime = newEnd;
  }

  const item = await db.planItem.update({ where: { id }, data });

  return NextResponse.json(item);
}

// Deletion is deliberately narrow: only items the user added themselves
// (source === "MANUAL") on the currently-active week. Claude's originally
// approved plan items are never deletable here — they're the historical
// record the recommendation engine's multi-week analysis reads from — and
// past weeks stay read-only, matching the calendar's own interactive={false}
// treatment of them.
export async function DELETE(
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

  if (existing.source !== "MANUAL") {
    return NextResponse.json(
      { error: "Only manually-added items can be deleted" },
      { status: 403 },
    );
  }

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const currentWeekOf = getCurrentWeekOf(user.weekStartDay, user.timezone);
  if (existing.weekOf.getTime() !== currentWeekOf.getTime()) {
    return NextResponse.json(
      { error: "Only items in the current week can be deleted" },
      { status: 403 },
    );
  }

  await db.planItem.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
