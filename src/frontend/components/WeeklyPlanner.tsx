"use client";

import { useState } from "react";
import Link from "next/link";
import type { WeeklyPlan } from "@prisma/client";
import type { WeeklyDraft } from "@/backend/claude";
import type { PlanItemLike } from "@/frontend/calendarTypes";
import { CategoryBadge, categoryClass } from "@/frontend/components/CategoryBadge";
import { CategoryLegend } from "@/frontend/components/CategoryLegend";
import { CalendarWeekView, normalizeDraftItems, normalizePlanItems } from "@/frontend/components/CalendarWeekView";
import { WeekGlanceView } from "@/frontend/components/WeekGlanceView";
import { WeekPicker } from "@/frontend/components/WeekNav";
import { AddPlanItemForm } from "@/frontend/components/AddPlanItemForm";

// The initial SSR-passed prop carries real Date objects (Next.js's RSC
// serialization preserves them), but every subsequent fetch() response goes
// through res.json() — plain JSON has no Date type, so those come back as
// ISO strings instead. Both plan and items are typed this way; date fields
// are always parsed with `new Date(...)` at render time rather than
// trusted as already being Date instances.
type PlanLike = Omit<WeeklyPlan, "weekOf" | "approvedAt" | "createdAt" | "updatedAt"> & {
  weekOf: string | Date;
  approvedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

// Same shape CalendarWeekView/AddPlanItemForm already use — declared once
// in calendarTypes.ts, aliased here rather than redefined.
type ItemLike = PlanItemLike;

type RecommendationLike = {
  id: string;
  content: string;
  category: string | null;
  type: string;
  createdAt: string | Date;
};

function byStartTime(a: ItemLike, b: ItemLike) {
  return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
}

export function WeeklyPlanner({
  initialPlan,
  initialItems,
  weekOf,
  weekStartDay,
  timezone,
  recommendations,
  prevHref,
  nextHref,
}: {
  initialPlan: PlanLike | null;
  initialItems: ItemLike[];
  weekOf: Date;
  weekStartDay: number;
  timezone: string;
  recommendations: RecommendationLike[];
  prevHref: string;
  nextHref: string | null;
}) {
  // Two independent state slots, deliberately not nested — a plan mutation
  // (submit/regenerate) must never implicitly clobber items, since
  // regenerate's response has no items field at all, and only approve's
  // response legitimately carries fresh items.
  const [plan, setPlan] = useState(initialPlan);
  const [items, setItems] = useState(initialItems.slice().sort(byStartTime));
  const [priorities, setPriorities] = useState("");
  const [adjustment, setAdjustment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Calendar (time-grid, drag-to-create/resize) vs. a plain per-day list
  // with the recommendations aside next to it — the list view is the
  // quick-glance read of the week, so suggestions live there rather than
  // competing for space with the calendar by default.
  const [viewMode, setViewMode] = useState<"calendar" | "glance">("calendar");

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
      const { items: newItems, ...planFields } = data;
      setPlan(planFields);
      setItems((newItems as ItemLike[]).slice().sort(byStartTime));
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

  function addItem(item: ItemLike) {
    setItems((prev) => [...prev, item].sort(byStartTime));
  }

  function updateItem(item: ItemLike) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)).sort(byStartTime));
  }

  function deleteItem(key: string) {
    setItems((prev) => prev.filter((i) => i.id !== key));
  }

  const draft = plan?.status === "PENDING" ? (plan.draftJson as unknown as WeeklyDraft) : null;
  const entries = [
    ...normalizePlanItems(items, timezone),
    ...(draft ? normalizeDraftItems(draft.items) : []),
  ];

  return (
    <div className="stack">
      <div className="week-header">
        <WeekPicker
          weekOf={weekOf}
          prevHref={prevHref}
          nextHref={nextHref}
          status={plan?.status === "APPROVED" ? "Locked in" : undefined}
        />
        <div className="controls-row">
          <div className="view-toggle">
            <button
              type="button"
              className={viewMode === "calendar" ? "toggle-active" : ""}
              onClick={() => setViewMode("calendar")}
            >
              Calendar
            </button>
            <button
              type="button"
              className={viewMode === "glance" ? "toggle-active" : ""}
              onClick={() => setViewMode("glance")}
            >
              Week at a glance
            </button>
          </div>
          <CategoryLegend />
          {viewMode === "calendar" && (
            <div className="add-item-inline">
              <AddPlanItemForm weekOf={weekOf} weekStartDay={weekStartDay} onCreated={addItem} />
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="error-box">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {!plan && (
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
      )}

      {draft && (
        <div className="stack">
          <p>{draft.summary}</p>
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
      )}

      {viewMode === "calendar" ? (
        <CalendarWeekView
          weekOf={weekOf}
          weekStartDay={weekStartDay}
          entries={entries}
          interactive
          onItemCreated={addItem}
          onItemResized={updateItem}
          onItemDeleted={deleteItem}
        />
      ) : (
        <div className="home-grid">
          {/* Read-only — no add/delete here, that's what the calendar view is for. */}
          <WeekGlanceView weekOf={weekOf} weekStartDay={weekStartDay} entries={entries} />

          <aside className="stack">
            {recommendations.length > 0 && (
              <section className="stack">
                <h2>Recent suggestions</h2>
                <ul className="item-list">
                  {recommendations.map((rec) => (
                    <li
                      key={rec.id}
                      className={rec.category ? categoryClass(rec.category) : ""}
                    >
                      <div className="item-row">
                        <span className="item-title">{rec.content}</span>
                        <div className="item-tags">
                          {rec.category && <CategoryBadge category={rec.category} />}
                          {rec.type === "PATTERN_INSIGHT" && (
                            <span className="insight-tag">PATTERN INSIGHT</span>
                          )}
                        </div>
                      </div>
                      <span className="recommendation-date">
                        {new Date(rec.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <Link href="/weeks" className="browse-weeks-link">
              <span>Browse past weeks</span>
              <span className="arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
