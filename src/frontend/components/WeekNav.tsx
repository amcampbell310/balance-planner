import Link from "next/link";

// weekOf/end are UTC-midnight date-only markers, not real instants —
// timeZone: "UTC" avoids an off-by-one-day shift on format.
export function formatWeekRange(weekOf: Date): string {
  const end = new Date(weekOf.getTime() + 6 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  return `Week of ${fmt(weekOf)} – ${fmt(end)}`;
}

// The bookend picker — prev arrow, label, next arrow — with an optional
// status pill on its own line underneath, both centered as a column (see
// .week-picker in globals.css) under the page title. The pill sits below
// rather than inline with the arrows specifically so the arrows/label row
// stays symmetric (same width on each side) — a status pill only ever
// appears on one side, so putting it in the same row shifts that row's
// visual center away from the label, which no longer lines up under a
// centered title above it. status is a plain string rather than this
// component deciding what counts as "locked in": WeeklyPlanner reacts to
// live client-side plan state for the current week, while the past-week
// branch reads a static checkIn row — each caller knows its own rule.
// nextHref is null when weekOf is already the current week — no future
// weeks exist in this app's model, you can only ever plan the current one.
export function WeekPicker({
  weekOf,
  prevHref,
  nextHref,
  status,
}: {
  weekOf: Date;
  prevHref: string;
  nextHref: string | null;
  status?: string;
}) {
  return (
    <div className="week-picker">
      <div className="week-picker-row">
        <Link href={prevHref} className="week-nav-arrow" aria-label="Previous week">
          ←
        </Link>
        <span className="week-nav-label">{formatWeekRange(weekOf)}</span>
        {nextHref ? (
          <Link href={nextHref} className="week-nav-arrow" aria-label="Next week">
            →
          </Link>
        ) : (
          <span className="week-nav-arrow" aria-hidden="true">
            →
          </span>
        )}
      </div>
      {status && <span className="week-nav-status">{status}</span>}
    </div>
  );
}
