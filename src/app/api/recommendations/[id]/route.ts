import { NextResponse } from "next/server";
import { RecommendationStatus } from "@prisma/client";
import { db } from "@/backend/db";
import { requireUserId } from "@/backend/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;

  const existing = await db.recommendation.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
  }

  const body = await request.json();
  const { status } = body as { status?: string };

  if (!status || !Object.values(RecommendationStatus).includes(status as RecommendationStatus)) {
    return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
  }

  const recommendation = await db.recommendation.update({
    where: { id },
    data: { status: status as RecommendationStatus, respondedAt: new Date() },
  });

  return NextResponse.json(recommendation);
}
