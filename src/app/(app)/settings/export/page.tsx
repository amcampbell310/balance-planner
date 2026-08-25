import Link from "next/link";
import { db } from "@/backend/db";
import { requireOnboardedUser } from "@/backend/gate";
import { formatHHMM } from "@/backend/week";
import { formatClockLabel } from "@/frontend/calendarTypes";
import { categoryLabel } from "@/frontend/components/CategoryBadge";
import { PageShell } from "@/frontend/components/PageShell";
import { PrintExportButton } from "@/frontend/components/PrintExportButton";

// The human-readable counterpart to /api/account/export's raw JSON — that
// file is for taking your data elsewhere; this is for actually reading it.
// Every week you've ever had items in, most recent first, grouped and
// formatted the same way the rest of the app already shows a week — plus
// print styles (globals.css's @media print block) so "save as PDF" via the
// browser's own print dialog produces something worth keeping, with no new
// PDF-generation dependency needed for that.
export default async function DataSummaryPage() {
  const user = await requireOnboardedUser();

  const [items, checkIns] = await Promise.all([
    db.planItem.findMany({ where: { userId: user.id }, orderBy: { startTime: "asc" } }),
    db.checkIn.findMany({ where: { userId: user.id } }),
  ]);

  const statusByWeek = new Map(checkIns.map((c) => [c.weekOf.toISOString(), c.status]));

  const weeks = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.weekOf.toISOString();
    const existing = weeks.get(key);
    if (existing) existing.push(item);
    else weeks.set(key, [item]);
  }
  const orderedWeeks = [...weeks.entries()].sort(([a], [b]) => (a < b ? 1 : -1));

  return (
    <PageShell title="Your data, readable">
      <div className="stack data-summary">
        <div className="data-summary-actions">
          <Link href="/settings">← Back to Settings</Link>
          <div className="data-summary-actions-right">
            <a href="/api/account/export" download className="secondary">
              Technical backup (JSON)
            </a>
            <PrintExportButton />
          </div>
        </div>

        {orderedWeeks.length === 0 ? (
          <p className="muted">Nothing planned yet — this fills in as you go.</p>
        ) : (
          orderedWeeks.map(([weekKey, weekItems]) => {
            const weekOf = weekItems[0].weekOf;
            const end = new Date(weekOf.getTime() + 6 * 24 * 60 * 60 * 1000);
            const fmt = (d: Date) =>
              d.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              });
            const status = statusByWeek.get(weekKey);

            return (
              <section key={weekKey} className="data-summary-week">
                <h2>
                  Week of {fmt(weekOf)} – {fmt(end)}
                  {status && <span className="muted"> · {status}</span>}
                </h2>
                <ul className="item-list">
                  {weekItems
                    .slice()
                    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
                    .map((item) => {
                      const [h, m] = formatHHMM(item.startTime, user.timezone)
                        .split(":")
                        .map(Number);
                      const [endH, endM] = formatHHMM(item.endTime, user.timezone)
                        .split(":")
                        .map(Number);
                      return (
                        <li key={item.id}>
                          <div className="item-row">
                            <span className="item-title">{item.title}</span>
                            <span className="muted">{item.status}</span>
                          </div>
                          <span className="item-meta">
                            {formatClockLabel(h, m)}–{formatClockLabel(endH, endM)} ·{" "}
                            {categoryLabel(item.category)}
                          </span>
                        </li>
                      );
                    })}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </PageShell>
  );
}
