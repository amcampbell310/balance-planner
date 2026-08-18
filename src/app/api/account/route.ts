import { NextResponse } from "next/server";
import { db } from "@/backend/db";
import { requireUserId } from "@/backend/auth";

// Soft delete — see prisma/schema.prisma's User.deletedAt comment: the
// account is treated as gone everywhere immediately (enforced in
// src/backend/auth.ts's session callback, which stops attaching
// session.user.id once deletedAt is set), while the row and its data
// survive for a grace period before a scheduled purge job hard-deletes it.
// That purge job doesn't exist yet — see documents/roadmap.md's backlog.
export async function DELETE() {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  await db.user.update({ where: { id: userId }, data: { deletedAt: new Date() } });

  return NextResponse.json({ success: true });
}
