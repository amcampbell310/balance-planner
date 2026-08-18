"use client";

import { useState } from "react";
import type { WeeklyPlan, PlanItem } from "@prisma/client";
import type { WeeklyDraft } from "@/backend/claude";

// The initial SSR-passed prop carries real Date objects (Next.js's RSC
// serialization preserves them), but every subsequent fetch() response goes
// through res.json() — plain JSON has no Date type, so those come back as
// ISO strings instead. This type reflects that both shapes actually occur;
// date fields are always parsed with `new Date(...)` at render time rather
// than trusted as already being Date instances.
type PlanWithItems = Omit<WeeklyPlan, "weekOf" | "approvedAt" | "createdAt" | "updatedAt"> & {
  weekOf: string | Date;
  approvedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  planItems: Array<
    Omit<PlanItem, "startTime" | "endTime" | "weekOf" | "createdAt" | "updatedAt"> & {
      startTime: string | Date;
      endTime: string | Date;
      weekOf: string | Date;
      createdAt: string | Date;
      updatedAt: string | Date;
    }
  >;
};

export function WeeklyPlanner({ initialPlan }: { initialPlan: PlanWithItems | null }) {
  const [plan, setPlan] = useState(initialPlan);
  const [priorities, setPriorities] = useState("");
  const [adjustment, setAdjustment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitPriorities() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/weekly-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priorities }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setPlan(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function approve() {
    if (!plan) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/weekly-plan/${plan.id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setPlan(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function regenerate() {
    if (!plan || !adjustment) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/weekly-plan/${plan.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setPlan(data);
      setAdjustment("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (error) {
    return (
      <div className="error-box">
        <p>{error}</p>
        <button onClick={() => setError(null)}>Try again</button>
      </div>
    );
  }

  // No plan yet this week — ask what they want.
  if (!plan) {
    return (
      <div className="stack">
        <p>What do you want this week? (gaming, date night, gym...)</p>
        <textarea
          value={priorities}
          onChange={(e) => setPriorities(e.target.value)}
          placeholder="e.g. 2 gaming nights, one date night on Friday, gym Tuesday/Thursday"
          rows={4}
        />
        <button onClick={submitPriorities} disabled={loading || !priorities.trim()}>
          {loading ? "Drafting..." : "Draft my week"}
        </button>
      </div>
    );
  }

  // Draft exists, not yet approved.
  if (plan.status === "PENDING") {
    const draft = plan.draftJson as unknown as WeeklyDraft;
    return (
      <div className="stack">
        <p>{draft.summary}</p>
        <ul className="item-list">
          {draft.items.map((item, i) => (
            <li key={i}>
              <strong>{item.title}</strong> — {item.category} — {item.dayOfWeek}{" "}
              {item.startTime}–{item.endTime}
            </li>
          ))}
        </ul>
        <button onClick={approve} disabled={loading}>
          {loading ? "Working..." : "Approve"}
        </button>
        <div className="stack">
          <textarea
            value={adjustment}
            onChange={(e) => setAdjustment(e.target.value)}
            placeholder='e.g. "move gaming to Thursday"'
            rows={2}
          />
          <button onClick={regenerate} disabled={loading || !adjustment.trim()}>
            {loading ? "Working..." : "Request changes"}
          </button>
        </div>
      </div>
    );
  }

  // Approved — show the real scheduled week.
  return (
    <div className="stack">
      <p>This week is locked in.</p>
      <ul className="item-list">
        {plan.planItems
          .slice()
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
          .map((item) => (
            <li key={item.id}>
              <strong>{item.title}</strong> — {item.category} —{" "}
              {new Date(item.startTime).toLocaleString()} ({item.status})
            </li>
          ))}
      </ul>
    </div>
  );
}
