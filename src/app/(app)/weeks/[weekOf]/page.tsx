import { notFound } from "next/navigation";
import { db } from "@/backend/db";
import { requireOnboardedUser } from "@/backend/gate";
import { PageShell } from "@/frontend/components/PageShell";
import { categoryClass, categoryLabel } from "@/frontend/components/CategoryBadge";
import { CategoryLegend } from "@/frontend/components/CategoryLegend";

// Read-only — past weeks are history, not something you go back and edit.
export default async function PastWeekDetailPage({
  params,
}: {
  params: Promise<{ weekOf: string }>;
}) {
  const user = await requireOnboardedUser();
  const { weekOf: weekOfParam } = await params;

  const weekOf = new Date(`${weekOfParam}T00:00:00.000Z`);
  if (Number.isNaN(weekOf.getTime())) notFound();

  const items = await db.planItem.findMany({
    where: { userId: user.id, weekOf },
    orderBy: { startTime: "asc" },
  });
  // 404, not empty state — same ownership-mismatch treatment used
  // throughout the API routes: don't distinguish "not yours" from
  // "doesn't exist."
  if (items.length === 0) notFound();

  const checkIn = await db.checkIn.findUnique({
    where: { userId_weekOf: { userId: user.id, weekOf } },
  });

  return (
    <PageShell title={`Week of ${weekOf.toLocaleDateString()}`}>
      <div className="stack">
        {checkIn && <p className="muted">Check-in: {checkIn.status}</p>}
        <CategoryLegend />
        <ul className="item-list">
          {items.map((item) => (
            <li
              key={item.id}
              className={`${categoryClass(item.category)} ${
                item.status === "MISSED" || item.status === "SKIPPED" ? "item-faded" : ""
              }`}
            >
              <div className="item-row">
                <span className="item-title">{item.title}</span>
                <span className={`status-tag status-${item.status.toLowerCase()}`}>
                  {item.status}
                </span>
              </div>
              <span className="item-meta">
                {new Date(item.startTime).toLocaleString()} · {categoryLabel(item.category)}
              </span>
              {item.statusNote && <span className="item-meta">"{item.statusNote}"</span>}
            </li>
          ))}
        </ul>
      </div>
    </PageShell>
  );
}
