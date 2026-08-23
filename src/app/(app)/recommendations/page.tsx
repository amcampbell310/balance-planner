import { requireOnboardedUser } from "@/backend/gate";
import { db } from "@/backend/db";
import { PageShell } from "@/frontend/components/PageShell";
import { RecommendationsList } from "@/frontend/components/RecommendationsList";

// Every status in one fetch, filtered client-side between Active/History —
// recommendation volume per user is small (bounded by the worker's own
// anti-spam throttling), so this avoids a round-trip on every tab switch.
export default async function RecommendationsPage() {
  const user = await requireOnboardedUser();
  const recommendations = await db.recommendation.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <PageShell title="Recommendations">
      <RecommendationsList initialRecommendations={recommendations} />
    </PageShell>
  );
}
