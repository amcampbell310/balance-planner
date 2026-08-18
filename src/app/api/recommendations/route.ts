import { NextRequest, NextResponse } from "next/server";
import { RecommendationStatus } from "@prisma/client";
import { db } from "@/backend/db";
import { requireUserId } from "@/backend/auth";

// Backs both the digest screen's "this week's suggestion" and the home
// screen's non-gating pattern-insight card — see diagrams/data-flow.mmd.
// Defaults to ACTIVE only; pass ?status= to see dismissed/acted-on history.
export async function GET(request: NextRequest) {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const statusParam = request.nextUrl.searchParams.get("status") ?? "ACTIVE";
  if (!Object.values(RecommendationStatus).includes(statusParam as RecommendationStatus)) {
    return NextResponse.json({ error: `Invalid status: ${statusParam}` }, { status: 400 });
  }

  const recommendations = await db.recommendation.findMany({
    where: { userId, status: statusParam as RecommendationStatus },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ recommendations });
}
