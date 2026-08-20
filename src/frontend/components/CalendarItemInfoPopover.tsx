"use client";

import { useEffect, useRef, useState } from "react";
import { CategoryBadge } from "@/frontend/components/CategoryBadge";
import { formatDuration, type CalendarEntry } from "@/frontend/calendarTypes";

// Click/tap-triggered rather than hover — works identically on mouse and
// touch (hover doesn't exist on touch devices, and this calendar has to
// support both). Mirrors CalendarDragPopover's rootRef + mousedown/Escape
// dismiss pattern; the only thing it can submit is a delete, gated by
// canDelete (the caller already knows both interactive and entry.deletable
// — DELETE /api/plan-items/[id] re-verifies everything server-side anyway).
export function CalendarItemInfoPopover({
  entry,
  x,
  y,
  canDelete,
  onDeleted,
  onDismiss,
}: {
  entry: CalendarEntry;
  x: number;
  y: number;
  canDelete: boolean;
  onDeleted: (key: string) => void;
  onDismiss: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/plan-items/${entry.key}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong");
      }
      onDeleted(entry.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setDeleting(false);
    }
  }

  const durationMinutes = entry.endSortMinutes - entry.sortMinutes;
  const clampedX = Math.min(x, window.innerWidth - 240);
  const clampedY = Math.min(y, window.innerHeight - 160);

  return (
    <div
      ref={rootRef}
      className="calendar-drag-popover calendar-info-popover"
      style={{ left: clampedX, top: clampedY }}
    >
      <div className="stack">
        <span className="item-title">{entry.title}</span>
        <span className="muted">
          {entry.timeLabel}–{entry.endTimeLabel} · {formatDuration(durationMinutes)}
        </span>
        <div className="item-tags">
          <CategoryBadge category={entry.category} />
          {entry.status && (
            <span className={`status-tag status-${entry.status.toLowerCase()}`}>
              {entry.status}
            </span>
          )}
          {entry.isDraft && <span className="draft-tag">DRAFT</span>}
        </div>
        {error && <p className="error-text">{error}</p>}
        {canDelete && (
          <button type="button" className="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </button>
        )}
      </div>
    </div>
  );
}
