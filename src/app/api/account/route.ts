import { NextRequest, NextResponse } from "next/server";
import { db } from "@/backend/db";
import { requireUserId } from "@/backend/auth";

// The "personalization" side of Settings (currently just name — see
// src/frontend/components/PersonalizationForm.tsx). A credentials signup
// requires a name up front (src/app/api/auth/signup/route.ts), but this is
// still the only way to set one for an account created before that
// requirement existed, or to change it later.
export async function PATCH(request: NextRequest) {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const { name } = body as { name?: string };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const user = await db.user.update({ where: { id: userId }, data: { name: name.trim() } });

  return NextResponse.json(user);
}

// Soft delete — see prisma/schema.prisma's User.deletedAt comment: the
// account is treated as gone everywhere immediately (enforced in
// src/backend/auth.ts's session callback, which stops attaching
// session.user.id once deletedAt is set), while the row and its data
// survive a 30-day grace period before src/backend/jobs/purgeDeletedAccounts.ts
// hard-deletes it (daily sweep, see src/worker/scheduler.ts).
export async function DELETE() {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  await db.user.update({ where: { id: userId }, data: { deletedAt: new Date() } });

  return NextResponse.json({ success: true });
}
