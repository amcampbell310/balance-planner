"use client";

import { useState } from "react";
import { CATEGORIES, WEEK_DAYS, TIMEZONES } from "@/frontend/constants";
import { Select } from "@/frontend/components/Select";

export function SettingsForm({
  initialCategories,
  initialTimezone,
  initialWeekStartDay,
}: {
  initialCategories: string[];
  initialTimezone: string;
  initialWeekStartDay: number;
}) {
  const [selected, setSelected] = useState<string[]>(initialCategories);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [weekStartDay, setWeekStartDay] = useState(initialWeekStartDay);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggle(category: string) {
    setSelected((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
    setSaved(false);
  }

  async function submit() {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedCategories: selected, timezone, weekStartDay }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <div>
        <p>What matters most to you?</p>
        <div className="checkbox-group">
          {CATEGORIES.map((c) => (
            <label key={c.value}>
              <input
                type="checkbox"
                checked={selected.includes(c.value)}
                onChange={() => toggle(c.value)}
              />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label>
          Timezone
          <Select
            value={timezone}
            onChange={(v) => {
              setTimezone(v);
              setSaved(false);
            }}
            options={TIMEZONES}
            filterable
          />
        </label>
      </div>

      <div>
        <label>
          Week starts on
          <Select
            value={String(weekStartDay)}
            onChange={(v) => {
              setWeekStartDay(Number(v));
              setSaved(false);
            }}
            options={WEEK_DAYS.map((d) => ({ value: String(d.value), label: d.label }))}
          />
        </label>
      </div>

      {error && <p className="error-text">{error}</p>}
      {saved && !error && <p className="muted">Saved.</p>}

      <button onClick={submit} disabled={loading || selected.length === 0}>
        {loading ? "Saving..." : "Save changes"}
      </button>
    </div>
  );
}
