"use client";

import { useEffect, useRef, useState } from "react";
import { getOrderedWeekDayNames, weekOfToParam } from "@/backend/week";
import { categoryClass, categoryLabel } from "@/frontend/components/CategoryBadge";
import { CalendarDragPopover } from "@/frontend/components/CalendarDragPopover";
import { CalendarItemInfoPopover } from "@/frontend/components/CalendarItemInfoPopover";
import {
  formatClockLabel,
  minutesToHHMM,
  normalizeDraftItems,
  normalizePlanItems,
  type CalendarEntry,
  type PlanItemLike,
} from "@/frontend/calendarTypes";

export type { PlanItemLike, CalendarEntry };
export { normalizePlanItems, normalizeDraftItems };

// Time runs horizontally (left = earlier, right = later), days stack as
// rows — chosen over a time-vertical/day-column layout because it lets
// collision-splitting shrink an item's HEIGHT (a shorter sub-row) instead
// of its WIDTH: an item's width stays driven by its actual duration no
// matter how many other items overlap it that day, which is what makes
// its title readable regardless of how busy the day gets. It also makes
// a left-right drag map directly onto "how long," which is the gesture
// the duration-drag feature is actually for.
// The time axis is percentage-based (fraction of the day, 0-100% across
// the row), not a fixed px/hour scale — a day-row's real rendered width
// varies by breakpoint (globals.css fits all 24 hours to the container
// above ~860px, falls back to a fixed scrollable width below it), and
// percentages resolve correctly against either without any JS branching:
// xToMinutes below reads the row's actual rect.width at drag-time rather
// than assuming a constant. A minimum on-screen width for very short
// items is enforced in CSS (.calendar-entry's min-width), not here, since
// JS has no reliable px conversion for a percentage it isn't measuring.
const MINUTES_PER_DAY = 24 * 60;
// Tall enough for both stacked lines a full entry can show (title row +
// meta row, each at 1.5 line-height per the global body style) plus
// padding/gap — measured short by ~4px at 40px, which clipped the meta
// line and looked like a phantom overlapping block underneath. Sized up
// further from that bare minimum so a day's row reads as a real block
// rather than a sliver, which is also what actually uses the page's
// available height instead of a taller-but-still-mostly-empty container.
const ITEM_ROW_HEIGHT_PX = 92;
const DAY_ROW_MIN_HEIGHT_PX = 92;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SNAP_MINUTES = 15;
const MIN_DURATION_MINUTES = 15;
const DEFAULT_CREATE_MINUTES = 60;
// How far a pointer must move before a gesture on empty grid space commits
// to being a horizontal create-drag rather than a vertical pan/scroll.
const DRAG_COMMIT_THRESHOLD_PX = 10;

export type PopoverState = {
  dayIndex: number;
  startMinutes: number;
  endMinutes: number;
  x: number;
  y: number;
};

type LayoutEntry = CalendarEntry & { column: number; columnCount: number };

// Standard interval-graph collision layout, two phases:
// 1. Cluster entries (sorted by start) into connected-overlap groups —
//    a new cluster starts only when the next entry's start is at or past
//    the RUNNING MAX end seen so far in the current cluster (not just the
//    last entry's end), which correctly captures transitive overlap
//    (A-B overlap, B-C overlap, A-C don't => all three still cluster).
// 2. Within each cluster, greedily assign columns in start-time order —
//    place each entry in the first column whose last entry ends at or
//    before this entry's start, else open a new column. For interval
//    graphs this greedy assignment is provably optimal: the resulting
//    column count equals the cluster's true max simultaneous-overlap
//    depth, not just a plausible upper bound.
// "Column" here means a sub-row within the day's row (see the axis note
// above) — every entry in a cluster renders at a uniform sub-row height,
// stacked column-index-many rows deep, while width stays duration-driven.
function computeDayColumns(dayEntries: CalendarEntry[]): LayoutEntry[] {
  const sorted = dayEntries.slice().sort((a, b) => a.sortMinutes - b.sortMinutes);

  const clusters: CalendarEntry[][] = [];
  let current: CalendarEntry[] = [];
  let clusterMaxEnd = -Infinity;
  for (const entry of sorted) {
    if (current.length > 0 && entry.sortMinutes >= clusterMaxEnd) {
      clusters.push(current);
      current = [];
      clusterMaxEnd = -Infinity;
    }
    current.push(entry);
    clusterMaxEnd = Math.max(clusterMaxEnd, entry.endSortMinutes);
  }
  if (current.length > 0) clusters.push(current);

  const result: LayoutEntry[] = [];
  for (const cluster of clusters) {
    const columns: CalendarEntry[][] = [];
    for (const entry of cluster) {
      const col = columns.find((c) => c[c.length - 1].endSortMinutes <= entry.sortMinutes);
      if (col) {
        col.push(entry);
      } else {
        columns.push([entry]);
      }
    }
    const columnCount = columns.length;
    columns.forEach((col, columnIndex) => {
      col.forEach((entry) => result.push({ ...entry, column: columnIndex, columnCount }));
    });
  }
  return result;
}

type DragCreateState = {
  dayIndex: number;
  rowEl: HTMLDivElement;
  startClientX: number;
  startClientY: number;
  startMinutes: number;
  currentMinutes: number;
  // Undetermined until the pointer has moved DRAG_COMMIT_THRESHOLD_PX — at
  // that point this becomes a real horizontal drag, or the gesture is
  // abandoned in favor of the browser's native vertical scroll.
  committed: boolean;
};

function clampMinutes(minutes: number): number {
  return Math.max(0, Math.min(24 * 60, minutes));
}

function snapMinutes(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

type ResizeState = {
  entryKey: string;
  dayOfWeek: string;
  rowEl: HTMLDivElement;
  startMinutes: number;
  currentEndMinutes: number;
};

export function CalendarWeekView({
  weekOf,
  weekStartDay,
  entries,
  interactive = false,
  onItemCreated,
  onItemResized,
  onItemDeleted,
}: {
  weekOf: Date;
  weekStartDay: number;
  entries: CalendarEntry[];
  interactive?: boolean;
  onItemCreated?: (item: PlanItemLike) => void;
  onItemResized?: (item: PlanItemLike) => void;
  onItemDeleted?: (key: string) => void;
}) {
  const dayNames = getOrderedWeekDayNames(weekStartDay);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragCreate, setDragCreate] = useState<DragCreateState | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [infoPopover, setInfoPopover] = useState<{ entry: CalendarEntry; x: number; y: number } | null>(
    null,
  );

  // Default the visible scroll position to roughly 6am rather than
  // midnight — most items fall in waking hours, but nothing outside that
  // range is hidden, just scrolled past. Expressed as a fraction of
  // whatever's actually scrollable: a no-op above the fluid-width
  // breakpoint (nothing to scroll, the whole day already fits), a real
  // scroll on the narrow fixed-width fallback.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: el.scrollWidth * (6 / 24) });
  }, []);

  function xToMinutes(clientX: number, rowEl: HTMLDivElement): number {
    const rect = rowEl.getBoundingClientRect();
    const rawMinutes = ((clientX - rect.left) / rect.width) * MINUTES_PER_DAY;
    return clampMinutes(snapMinutes(rawMinutes));
  }

  function handleRowPointerDown(e: React.PointerEvent<HTMLDivElement>, dayIndex: number) {
    if (!interactive) return;
    // Only empty backdrop starts a create-drag — entries stopPropagation
    // on their own pointerdown so clicking/resizing one never also starts
    // a phantom create-drag on the row beneath it.
    const minutes = xToMinutes(e.clientX, e.currentTarget);
    setDragCreate({
      dayIndex,
      rowEl: e.currentTarget,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startMinutes: minutes,
      currentMinutes: minutes,
      committed: false,
    });
  }

  useEffect(() => {
    if (!dragCreate) return;

    function handleMove(e: PointerEvent) {
      setDragCreate((prev) => {
        if (!prev) return prev;
        const dx = e.clientX - prev.startClientX;
        const dy = e.clientY - prev.startClientY;

        if (!prev.committed) {
          if (Math.hypot(dx, dy) < DRAG_COMMIT_THRESHOLD_PX) return prev;
          if (Math.abs(dy) > Math.abs(dx)) {
            // Vertical wins — this is a pan/scroll gesture, not a
            // create-drag. Abandon it and let native scroll take over.
            return null;
          }
        }

        const minutes = xToMinutes(e.clientX, prev.rowEl);
        return { ...prev, currentMinutes: minutes, committed: true };
      });
    }

    function handleUp(e: PointerEvent) {
      setDragCreate((prev) => {
        if (!prev) return null;

        // A genuine quick click never accumulates enough movement to
        // commit — but it's still a real gesture on empty grid space, so
        // it falls through to the same near-click default-block logic
        // below rather than being silently discarded.
        let start = Math.min(prev.startMinutes, prev.currentMinutes);
        let end = Math.max(prev.startMinutes, prev.currentMinutes);
        if (end - start < MIN_DURATION_MINUTES) {
          end = clampMinutes(start + DEFAULT_CREATE_MINUTES);
          start = clampMinutes(end - DEFAULT_CREATE_MINUTES);
        }

        setPopover({
          dayIndex: prev.dayIndex,
          startMinutes: start,
          endMinutes: end,
          x: e.clientX,
          y: e.clientY,
        });
        return null;
      });
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragCreate]);

  function handleResizePointerDown(e: React.PointerEvent<HTMLDivElement>, entry: LayoutEntry) {
    e.stopPropagation();
    const rowEl = e.currentTarget.closest<HTMLDivElement>(".calendar-day-row");
    if (!rowEl) return;
    setResize({
      entryKey: entry.key,
      dayOfWeek: entry.dayOfWeek,
      rowEl,
      startMinutes: entry.sortMinutes,
      currentEndMinutes: entry.endSortMinutes,
    });
  }

  useEffect(() => {
    if (!resize) return;

    function handleMove(e: PointerEvent) {
      setResize((prev) => {
        if (!prev) return prev;
        const minutes = xToMinutes(e.clientX, prev.rowEl);
        const clamped = Math.max(minutes, prev.startMinutes + MIN_DURATION_MINUTES);
        return { ...prev, currentEndMinutes: clamped };
      });
    }

    async function handleUp() {
      const current = resize;
      setResize(null);
      if (!current) return;

      const dayIndex = dayNames.indexOf(current.dayOfWeek);
      const dayDate = new Date(weekOf.getTime() + dayIndex * 24 * 60 * 60 * 1000);
      const dateStr = weekOfToParam(dayDate);
      const res = await fetch(`/api/plan-items/${current.entryKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endTime: new Date(`${dateStr}T${minutesToHHMM(current.currentEndMinutes)}`),
        }),
      });
      if (res.ok) {
        const item = await res.json();
        onItemResized?.(item);
      }
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resize]);

  return (
    <div className="calendar-grid" ref={scrollRef} data-interactive={interactive}>
      <div className="calendar-grid-inner">
        <div className="calendar-gutter-corner" />
        {HOURS.map((h) => (
          <div key={h} className="calendar-hour-header" style={{ gridColumn: h + 2 }}>
            {formatClockLabel(h, 0)}
          </div>
        ))}

        {dayNames.map((dayName, i) => {
          // weekOf's Y-M-D is a date-only marker (not a real instant) —
          // pinning timeZone: "UTC" avoids an off-by-one-day shift that
          // formatting without it could introduce depending on local zone.
          const columnDate = new Date(weekOf.getTime() + i * 24 * 60 * 60 * 1000);
          const dateLabel = columnDate.toLocaleDateString(undefined, {
            weekday: "short",
            month: "numeric",
            day: "numeric",
            timeZone: "UTC",
          });
          return (
            <div key={dayName} className="calendar-gutter-day" style={{ gridRow: i + 2 }}>
              {dateLabel}
            </div>
          );
        })}

        {dayNames.map((dayName, i) => {
          const dayEntries = computeDayColumns(entries.filter((e) => e.dayOfWeek === dayName));
          const maxColumnCount = dayEntries.reduce((max, e) => Math.max(max, e.columnCount), 1);
          const rowHeight = Math.max(DAY_ROW_MIN_HEIGHT_PX, maxColumnCount * ITEM_ROW_HEIGHT_PX);
          const previewActive =
            interactive && dragCreate?.committed && dragCreate.dayIndex === i;

          return (
            <div
              key={dayName}
              className="calendar-day-row"
              style={{ gridColumn: "2 / span 24", gridRow: i + 2, height: rowHeight }}
              onPointerDown={
                interactive ? (e) => handleRowPointerDown(e, i) : undefined
              }
            >
              {dayEntries.map((entry) => {
                const resizingThis = resize?.entryKey === entry.key;
                const effectiveEnd = resizingThis ? resize.currentEndMinutes : entry.endSortMinutes;
                const durationMinutes = effectiveEnd - entry.sortMinutes;
                const left = `${(entry.sortMinutes / MINUTES_PER_DAY) * 100}%`;
                const width = `${(durationMinutes / MINUTES_PER_DAY) * 100}%`;
                const top = entry.column * ITEM_ROW_HEIGHT_PX;
                const height = ITEM_ROW_HEIGHT_PX;
                // Duration-based, not measured-pixel-based — width is a
                // percentage of the row's real (breakpoint-dependent)
                // rendered size, which JS never measures for a static
                // entry, but duration already tracks it closely since
                // width is duration-proportional at any container size.
                const showMeta = durationMinutes >= 90;
                const showTags = durationMinutes >= 165;
                const canResize = interactive && !entry.isDraft;
                const endLabel = resizingThis
                  ? formatClockLabel(Math.floor(effectiveEnd / 60), effectiveEnd % 60)
                  : entry.endTimeLabel;

                return (
                  <div
                    key={entry.key}
                    className={`calendar-entry ${categoryClass(entry.category)} ${
                      entry.status === "MISSED" || entry.status === "SKIPPED" ? "item-faded" : ""
                    } ${entry.isDraft ? "is-draft" : ""}`}
                    style={{ top, height, left, width }}
                    title={entry.title}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setInfoPopover({ entry, x: e.clientX, y: e.clientY });
                    }}
                  >
                    <div className="item-row">
                      <span className="item-title">{entry.title}</span>
                      {showTags && entry.status && (
                        <span className={`status-tag status-${entry.status.toLowerCase()}`}>
                          {entry.status}
                        </span>
                      )}
                      {showTags && entry.isDraft && <span className="draft-tag">DRAFT</span>}
                    </div>
                    {showMeta && (
                      <span className="item-meta">
                        {entry.timeLabel}–{endLabel} · {categoryLabel(entry.category)}
                      </span>
                    )}
                    {canResize && (
                      <div
                        className="resize-handle"
                        onPointerDown={(e) => handleResizePointerDown(e, entry)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </div>
                );
              })}

              {previewActive && (
                <div
                  className="drag-preview"
                  style={{
                    left: `${(Math.min(dragCreate.startMinutes, dragCreate.currentMinutes) / MINUTES_PER_DAY) * 100}%`,
                    width: `${(Math.abs(dragCreate.currentMinutes - dragCreate.startMinutes) / MINUTES_PER_DAY) * 100}%`,
                    top: 0,
                    bottom: 0,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {popover && (
        <CalendarDragPopover
          weekOf={weekOf}
          dayIndex={popover.dayIndex}
          startMinutes={popover.startMinutes}
          endMinutes={popover.endMinutes}
          x={popover.x}
          y={popover.y}
          onCreated={(item) => {
            onItemCreated?.(item);
            setPopover(null);
          }}
          onDismiss={() => setPopover(null)}
        />
      )}

      {infoPopover && (
        <CalendarItemInfoPopover
          entry={infoPopover.entry}
          x={infoPopover.x}
          y={infoPopover.y}
          canDelete={interactive && infoPopover.entry.deletable}
          onDeleted={(key) => {
            onItemDeleted?.(key);
            setInfoPopover(null);
          }}
          onDismiss={() => setInfoPopover(null)}
        />
      )}
    </div>
  );
}
