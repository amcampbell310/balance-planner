"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIES } from "@/frontend/constants";
import { Select } from "@/frontend/components/Select";
import { weekOfToParam } from "@/backend/week";
import { formatClockLabel, minutesToHHMM, type PlanItemLike } from "@/frontend/calendarTypes";

// Opens right where the user just dragged, pre-filled with the dragged
// time range — mirrors AddPlanItemForm's submit logic (same POST
// /api/plan-items contract) and Select.tsx's rootRef + mousedown/Escape
// dismiss pattern, rather than introducing a new floating-UI approach.
export function CalendarDragPopover({
  weekOf,
  dayIndex,
  startMinutes,
  endMinutes,
  x,
  y,
  onCreated,
  onDismiss,
}: {
  weekOf: Date;
  dayIndex: number;
  startMinutes: number;
  endMinutes: number;
  x: number;
  y: number;
  onCreated: (item: PlanItemLike) => void;
  onDismiss: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0].value);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onDismiss();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onDismiss]);

  async function submit() {
    if (!title) {
      setError("Title is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const dayDate = new Date(weekOf.getTime() + dayIndex * 24 * 60 * 60 * 1000);
      const dateStr = weekOfToParam(dayDate);
      const res = await fetch("/api/plan-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          startTime: new Date(`${dateStr}T${minutesToHHMM(startMinutes)}`),
          endTime: new Date(`${dateStr}T${minutesToHHMM(endMinutes)}`),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      onCreated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  // Clamp near viewport edges so the popover never renders off-screen.
  const clampedX = Math.min(x, window.innerWidth - 260);
  const clampedY = Math.min(y, window.innerHeight - 220);

  return (
    <div
      ref={rootRef}
      className="calendar-drag-popover"
      style={{ left: clampedX, top: clampedY }}
    >
      <div className="stack">
        <span className="muted">
          {formatClockLabel(Math.floor(startMinutes / 60), startMinutes % 60)}–
          {formatClockLabel(Math.floor(endMinutes / 60), endMinutes % 60)}
        </span>
        <input
          autoFocus
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Select value={category} onChange={setCategory} options={[...CATEGORIES]} />
        {error && <p className="error-text">{error}</p>}
        <div className="status-buttons">
          <button type="button" onClick={submit} disabled={loading}>
            {loading ? "Adding..." : "Add"}
          </button>
          <button type="button" className="secondary" onClick={onDismiss} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
