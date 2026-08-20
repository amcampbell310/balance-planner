import { getOrderedWeekDayNames } from "@/backend/week";
import { categoryClass, categoryLabel } from "@/frontend/components/CategoryBadge";
import { formatDuration, type CalendarEntry } from "@/frontend/calendarTypes";

// The simpler, pre-time-grid presentation: each day as a labeled section,
// items listed top to bottom in a plain .item-list rather than positioned
// on a time axis — meant for a fast read of the week, not for editing it.
// Deliberately read-only (no add/delete) — the calendar view is the one
// place for changing what's scheduled; this one is just for looking.
// Reuses the same normalized CalendarEntry[] the calendar renders, so both
// views always agree on what's actually scheduled.
export function WeekGlanceView({
  weekOf,
  weekStartDay,
  entries,
}: {
  weekOf: Date;
  weekStartDay: number;
  entries: CalendarEntry[];
}) {
  const dayNames = getOrderedWeekDayNames(weekStartDay);

  return (
    <div className="week-glance">
      {dayNames.map((dayName, i) => {
        const dayEntries = entries
          .filter((e) => e.dayOfWeek === dayName)
          .sort((a, b) => a.sortMinutes - b.sortMinutes);
        const columnDate = new Date(weekOf.getTime() + i * 24 * 60 * 60 * 1000);
        const dateLabel = columnDate.toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        });

        // Empty days collapse to a single quiet line instead of a full
        // section — most weeks only have items on 3-4 days, and a full
        // header + "Nothing scheduled" paragraph per empty day was most of
        // what made this view taller than the content actually needed.
        if (dayEntries.length === 0) {
          return (
            <div key={dayName} className="glance-day-empty">
              <span className="glance-day-name">{dateLabel}</span>
              <span className="muted">Nothing scheduled</span>
            </div>
          );
        }

        return (
          <section key={dayName} className="glance-day">
            <h3>{dateLabel}</h3>
            <ul className="item-list">
              {dayEntries.map((entry) => {
                const durationMinutes = entry.endSortMinutes - entry.sortMinutes;
                return (
                  <li
                    key={entry.key}
                    className={`${categoryClass(entry.category)} ${
                      entry.status === "MISSED" || entry.status === "SKIPPED"
                        ? "item-faded"
                        : ""
                    } ${entry.isDraft ? "is-draft" : ""}`}
                  >
                    <div className="item-row">
                      <span className="item-title">{entry.title}</span>
                      <div className="item-tags">
                        {entry.status && (
                          <span className={`status-tag status-${entry.status.toLowerCase()}`}>
                            {entry.status}
                          </span>
                        )}
                        {entry.isDraft && <span className="draft-tag">DRAFT</span>}
                      </div>
                    </div>
                    <span className="item-meta">
                      {entry.timeLabel}–{entry.endTimeLabel} · {formatDuration(durationMinutes)} ·{" "}
                      {categoryLabel(entry.category)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
