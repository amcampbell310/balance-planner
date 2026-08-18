import { NextResponse } from "next/server";
import { db } from "@/backend/db";
import { requireUserId } from "@/backend/auth";

export async function GET() {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });

  return NextResponse.json({ onboarded: user.onboarded });
}
