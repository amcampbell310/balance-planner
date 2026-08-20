"use client";

import { useEffect, useRef, useState } from "react";
import type { PlanItem } from "@prisma/client";
import { CATEGORIES } from "@/frontend/constants";
import { Select } from "@/frontend/components/Select";
import { getOrderedWeekDayNames, weekOfToParam } from "@/backend/week";
import { formatDuration } from "@/frontend/calendarTypes";

const DEFAULT_DURATION_MINUTES = 60;
const DURATION_STEP_MINUTES = 15;
const MAX_DURATION_MINUTES = 6 * 60;
const DURATION_OPTIONS = Array.from(
  { length: MAX_DURATION_MINUTES / DURATION_STEP_MINUTES },
  (_, i) => {
    const minutes = (i + 1) * DURATION_STEP_MINUTES;
    return { value: String(minutes), label: formatDuration(minutes) };
  },
);

// minutes added to a "HH:MM" start time, clamped so it never rolls past
// midnight — items here are always same-day (one date field for the day,
// used for both start and end).
function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// The native time input's `step` attribute only constrains its spinner/
// picker UI — most browsers still accept an arbitrary typed value (e.g.
// "3:07"), so the 15-minute grid every item in this app is snapped to
// needs to actually be enforced here too, not just hinted at via `step`.
function snapToStep(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(
    Math.round((h * 60 + m) / DURATION_STEP_MINUTES) * DURATION_STEP_MINUTES,
    23 * 60 + 59,
  );
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// An anchored popover (same rootRef + mousedown/Escape dismiss pattern as
// Select.tsx and the calendar's own drag-create/info popovers), not an
// inline expanding block — picking a day of this week (via
// getOrderedWeekDayNames, matching the calendar's own day order) instead of
// a raw date input, since this form is only ever shown for the currently-
// viewed week (there's nothing else a date picker's min/max would allow
// anyway) and clicking a day pill is faster than operating a native date
// widget for a choice that's really "which of these 7 days." Duration is
// picked from a 15-minute-increment list rather than a raw end-time input —
// every item in this app is already on a 15-minute grid (see
// CalendarWeekView's SNAP_MINUTES), so an end-time picker was offering
// precision nothing else in the app uses.
export function AddPlanItemForm({
  weekOf,
  weekStartDay,
  onCreated,
}: {
  weekOf: Date;
  weekStartDay: number;
  onCreated: (item: PlanItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0].value);
  const [dayIndex, setDayIndex] = useState<number | null>(null);
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_DURATION_MINUTES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const dayNames = getOrderedWeekDayNames(weekStartDay);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function reset() {
    setTitle("");
    setCategory(CATEGORIES[0].value);
    setDayIndex(null);
    setStartTime("");
    setDurationMinutes(DEFAULT_DURATION_MINUTES);
    setError(null);
  }

  function close() {
    reset();
    setOpen(false);
  }

  async function submit() {
    if (!title || dayIndex === null || !startTime) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const dayDate = new Date(weekOf.getTime() + dayIndex * 24 * 60 * 60 * 1000);
      const dateStr = weekOfToParam(dayDate);
      // Backstop, not just the onBlur snap — Add can be reached without
      // ever blurring the field (e.g. a screen reader or assistive input).
      const snappedStart = snapToStep(startTime);
      const endTime = addMinutes(snappedStart, durationMinutes);
      const res = await fetch("/api/plan-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          // The browser's local timezone is used to interpret date+time
          // here — correct for the common case where it matches the
          // user's configured app timezone; POST /api/plan-items already
          // expects plain ISO datetime strings, same contract as before.
          startTime: new Date(`${dateStr}T${snappedStart}`),
          endTime: new Date(`${dateStr}T${endTime}`),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      onCreated(data);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="add-item-root" ref={rootRef}>
      <button type="button" className="secondary" onClick={() => setOpen((v) => !v)}>
        + Add item
      </button>

      {open && (
        <div className="add-item-panel stack">
          <input
            autoFocus
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Select value={category} onChange={setCategory} options={[...CATEGORIES]} />

          <div className="day-picker">
            {dayNames.map((dayName, i) => {
              const dayDate = new Date(weekOf.getTime() + i * 24 * 60 * 60 * 1000);
              const label = dayDate.toLocaleDateString(undefined, {
                weekday: "short",
                day: "numeric",
                timeZone: "UTC",
              });
              return (
                <button
                  type="button"
                  key={dayName}
                  className={`day-pill${dayIndex === i ? " selected" : ""}`}
                  onClick={() => setDayIndex(i)}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="add-item-time-row">
            <input
              type="time"
              step={DURATION_STEP_MINUTES * 60}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              onBlur={(e) => {
                // Snap on blur, not on every keystroke — snapping mid-entry
                // would fight the browser's own segment-by-segment typing.
                if (e.target.value) setStartTime(snapToStep(e.target.value));
              }}
            />
            <Select
              value={String(durationMinutes)}
              onChange={(v) => setDurationMinutes(Number(v))}
              options={DURATION_OPTIONS}
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="status-buttons">
            <button type="button" onClick={submit} disabled={loading}>
              {loading ? "Adding..." : "Add"}
            </button>
            <button type="button" className="secondary" onClick={close} disabled={loading}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
