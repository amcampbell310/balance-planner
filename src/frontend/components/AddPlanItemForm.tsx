"use client";

import { useState } from "react";
import type { PlanItem } from "@prisma/client";
import { CATEGORIES } from "@/frontend/constants";
import { Select } from "@/frontend/components/Select";

// One hour past a "HH:MM" time, clamped so it never rolls past midnight —
// items here are always same-day (one date field for both start and end).
function addOneHour(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(h * 60 + m + 60, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// Inline-toggle reveal, same pattern as DeleteAccountSection.tsx — no
// modal component exists in this codebase yet, don't introduce one here.
export function AddPlanItemForm({
  weekOf,
  onCreated,
}: {
  weekOf: Date;
  onCreated: (item: PlanItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0].value);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  // Once the user edits end time directly, stop overwriting it — until
  // then, changing start time keeps end time defaulted to start + 1hr, so
  // adding a quick item usually only means picking one time, not two.
  const [endTimeTouched, setEndTimeTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minDate = weekOf.toISOString().slice(0, 10);
  const maxDate = new Date(weekOf.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  function reset() {
    setTitle("");
    setCategory(CATEGORIES[0].value);
    setDate("");
    setStartTime("");
    setEndTime("");
    setEndTimeTouched(false);
    setError(null);
  }

  async function submit() {
    if (!title || !date || !startTime || !endTime) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
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
          startTime: new Date(`${date}T${startTime}`),
          endTime: new Date(`${date}T${endTime}`),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      onCreated(data);
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="secondary" onClick={() => setOpen(true)}>
        + Add item
      </button>
    );
  }

  return (
    <div className="stack">
      <input
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Select value={category} onChange={setCategory} options={[...CATEGORIES]} />
      <input
        type="date"
        value={date}
        min={minDate}
        max={maxDate}
        onChange={(e) => setDate(e.target.value)}
      />
      <div className="item-row">
        <input
          type="time"
          value={startTime}
          onChange={(e) => {
            const value = e.target.value;
            setStartTime(value);
            if (!endTimeTouched && value) setEndTime(addOneHour(value));
          }}
        />
        <input
          type="time"
          value={endTime}
          onChange={(e) => {
            setEndTime(e.target.value);
            setEndTimeTouched(true);
          }}
        />
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="status-buttons">
        <button type="button" onClick={submit} disabled={loading}>
          {loading ? "Adding..." : "Add"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          disabled={loading}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
