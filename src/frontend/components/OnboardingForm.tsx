"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, WEEK_DAYS, TIMEZONES } from "@/frontend/constants";
import { Select } from "@/frontend/components/Select";

export function OnboardingForm() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [weekStartDay, setWeekStartDay] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(category: string) {
    setSelected((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedCategories: selected, timezone, weekStartDay }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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
          <Select value={timezone} onChange={setTimezone} options={TIMEZONES} filterable />
        </label>
      </div>

      <div>
        <label>
          Week starts on
          <Select
            value={String(weekStartDay)}
            onChange={(v) => setWeekStartDay(Number(v))}
            options={WEEK_DAYS.map((d) => ({ value: String(d.value), label: d.label }))}
          />
        </label>
      </div>

      {error && <p className="error-text">{error}</p>}

      <button onClick={submit} disabled={loading || selected.length === 0}>
        {loading ? "Saving..." : "Continue"}
      </button>
    </div>
  );
}
