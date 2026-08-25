"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { WeeklyPlan } from "@prisma/client";
import type { WeeklyDraft } from "@/backend/claude";
import type { PlanItemLike } from "@/frontend/calendarTypes";
import { dateToDayOfWeek, dayOfWeekToDate, formatHHMM } from "@/backend/week";
import { CategoryBadge, categoryClass, categoryLabel } from "@/frontend/components/CategoryBadge";
import { CategoryLegend } from "@/frontend/components/CategoryLegend";
import { CalendarWeekView, normalizeDraftItems, normalizePlanItems } from "@/frontend/components/CalendarWeekView";
import { WeekGlanceView } from "@/frontend/components/WeekGlanceView";
import { WeekPicker } from "@/frontend/components/WeekNav";
import { AddPlanItemForm } from "@/frontend/components/AddPlanItemForm";
import { Modal } from "@/frontend/components/Modal";

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

// Quick-add starting points for the priorities box — not a replacement for
// free text, just a faster way into it. Appending phrases (not replacing
// the whole field) is deliberate: Claude already handles free-text
// priorities well, so this doesn't change what it receives, just how fast
// a user gets there.
const PRIORITY_TEMPLATES = [
  "a date night",
  "game night with friends",
  "a gym session",
  "time with friends",
  "catch up on chores",
  "keep it light this week",
  "pack the week",
];

export function WeeklyPlanner({
  initialPlan,
  initialItems,
  previousWeekItems,
  weekOf,
  weekStartDay,
  timezone,
  selectedCategories,
  recommendations,
  prevHref,
  nextHref,
}: {
  initialPlan: PlanLike | null;
  initialItems: ItemLike[];
  previousWeekItems: ItemLike[];
  weekOf: Date;
  weekStartDay: number;
  timezone: string;
  selectedCategories: string[];
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
  // The summary/excluded-requests/approve/regenerate panel used to sit
  // inline permanently, taking real vertical space for what's usually a
  // couple sentences — the calendar underneath already shows the draft
  // items visually (dashed "DRAFT" tags), so this only needs to be open
  // when actively reviewing. Starts open if a pending draft already exists
  // on load (came back to an undecided draft) or right after one's created.
  const [draftModalOpen, setDraftModalOpen] = useState(initialPlan?.status === "PENDING");
  // Same reasoning as draftModalOpen — this used to render as a permanent
  // inline block of full-size item cards before any plan existed, which was
  // a lot of vertical space for something only relevant once, briefly, at
  // the start of a week. Defaults open (there's nothing else competing for
  // attention yet at that point), but becomes a reopenable banner once
  // dismissed or once every candidate's been copied.
  const [recurringModalOpen, setRecurringModalOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Calendar (time-grid, drag-to-create/resize) vs. a plain per-day list
  // with the recommendations aside next to it — the list view is the
  // quick-glance read of the week, so suggestions live there rather than
  // competing for space with the calendar by default.
  const [viewMode, setViewMode] = useState<"calendar" | "glance">("calendar");

  // "Same as last week?" — only meaningful before this week has a plan of
  // its own yet. Matched on title+category+day-of-week+local time, not
  // just title, so e.g. a Work Shift that moved days doesn't get treated
  // as already present. Recomputed from props/state each render rather
  // than stored — it only ever needs to reflect "what's true right now."
  function itemSignature(item: ItemLike): string {
    const start = new Date(item.startTime);
    const end = new Date(item.endTime);
    return [
      item.title,
      item.category,
      dateToDayOfWeek(start, timezone),
      formatHHMM(start, timezone),
      formatHHMM(end, timezone),
    ].join("|");
  }
  // "Not this week" — a one-way, session-local dismissal (not persisted),
  // same lightweight nature as the checked/unchecked selection below. Filtered
  // in here rather than at the source so itemSignature-based dedup and
  // dismissal don't need to be reconciled in two places.
  const [dismissedRecurring, setDismissedRecurring] = useState<Set<string>>(new Set());
  const currentSignatures = new Set(items.map(itemSignature));
  const recurringCandidates = previousWeekItems.filter(
    (item) => !currentSignatures.has(itemSignature(item)) && !dismissedRecurring.has(item.id),
  );
  const [checkedRecurring, setCheckedRecurring] = useState<Set<string> | null>(null);
  // Lazily defaults to "everything checked" on first render that actually
  // has candidates, rather than in useState's initializer (previousWeekItems
  // is stable per page load, but this keeps the default computed from the
  // same itemSignature dedup logic above instead of duplicating it).
  const checked = checkedRecurring ?? new Set(recurringCandidates.map((i) => i.id));

  function toggleRecurring(id: string) {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCheckedRecurring(next);
  }

  function dismissRecurring(id: string) {
    setDismissedRecurring((prev) => new Set(prev).add(id));
  }

  async function copyRecurringItems() {
    setLoading(true);
    setError(null);
    try {
      const toCopy = recurringCandidates.filter((item) => checked.has(item.id));
      for (const item of toCopy) {
        const start = new Date(item.startTime);
        const end = new Date(item.endTime);
        const dayOfWeek = dateToDayOfWeek(start, timezone);
        const newStart = dayOfWeekToDate(
          weekOf,
          weekStartDay,
          dayOfWeek,
          formatHHMM(start, timezone),
          timezone,
        );
        const newEnd = dayOfWeekToDate(
          weekOf,
          weekStartDay,
          dayOfWeek,
          formatHHMM(end, timezone),
          timezone,
        );
        const res = await fetch("/api/plan-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.title,
            category: item.category,
            startTime: newStart,
            endTime: newEnd,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Something went wrong");
        addItem(data);
      }
      setCheckedRecurring(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function addTemplate(phrase: string) {
    setPriorities((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return phrase;
      // A trailing sentence-ending punctuation reads as a clean stopping
      // point already; anything else gets a comma so the appended phrase
      // doesn't just run into the previous word.
      const needsComma = !/[.!?,]$/.test(trimmed);
      return `${trimmed}${needsComma ? "," : ""} ${phrase}`;
    });
  }

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
      setDraftModalOpen(true);
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

  // The hard category filter (src/backend/claude.ts's programmatic
  // backstop) stays absolute — nothing slips through silently. This is the
  // fast-path fix instead: add the missing category to the account, then
  // regenerate with the excluded request as the adjustment text, so Claude
  // reconsiders it now that it's actually allowed.
  async function addCategoryAndRegenerate(category: string, description: string) {
    if (!plan) return;
    setLoading(true);
    setError(null);
    try {
      const settingsRes = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedCategories: [...selectedCategories, category],
          timezone,
          weekStartDay,
        }),
      });
      if (!settingsRes.ok) {
        const data = await settingsRes.json();
        throw new Error(data.error ?? "Couldn't update your categories");
      }

      const res = await fetch(`/api/weekly-plan/${plan.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustment: `Also schedule: ${description}` }),
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

  function addItem(item: ItemLike) {
    setItems((prev) => [...prev, item].sort(byStartTime));
  }

  function updateItem(item: ItemLike) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)).sort(byStartTime));
  }

  function deleteItem(key: string) {
    setItems((prev) => prev.filter((i) => i.id !== key));
  }

  // excludedRequests is defaulted here, not just typed as required — a
  // WeeklyPlan.draftJson stored before that field existed in the schema
  // (any PENDING plan from before this change) won't actually have it at
  // runtime, and this is the one place that needs to account for that.
  const rawDraft = plan?.status === "PENDING" ? (plan.draftJson as unknown as WeeklyDraft) : null;
  const draft = rawDraft ? { ...rawDraft, excludedRequests: rawDraft.excludedRequests ?? [] } : null;
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
        {draft && !draftModalOpen && (
          // The calendar below already shows the draft items visually
          // (dashed "DRAFT" tags) — this is just a way back into the
          // review panel once it's been dismissed, not a second copy of
          // the content. Its own centered row, matching the WeekPicker
          // above it, rather than living in the left-aligned controls row.
          <div className="draft-banner-row">
            <button type="button" className="draft-banner" onClick={() => setDraftModalOpen(true)}>
              <span>Week drafted</span>
              {draft.excludedRequests.length > 0 && (
                <span className="draft-banner-badge">{draft.excludedRequests.length}</span>
              )}
              <span>— Review &amp; approve</span>
            </button>
          </div>
        )}
        {!plan && recurringCandidates.length > 0 && !recurringModalOpen && (
          <div className="draft-banner-row">
            <button
              type="button"
              className="draft-banner"
              onClick={() => setRecurringModalOpen(true)}
            >
              <span>Same as last week?</span>
              <span className="draft-banner-badge">{recurringCandidates.length}</span>
              <span>— Review items</span>
            </button>
          </div>
        )}
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

      <Modal
        open={!plan && recurringCandidates.length > 0 && recurringModalOpen}
        onClose={() => setRecurringModalOpen(false)}
        title="Same as last week?"
      >
        <div className="stack">
          <p className="muted">Are these the same this week? Copy the ones that still apply.</p>
          <ul className="item-list recurring-item-list">
            {recurringCandidates.map((item) => {
              const start = new Date(item.startTime);
              const end = new Date(item.endTime);
              return (
                <li key={item.id} className={categoryClass(item.category)}>
                  <div className="recurring-item-row">
                    <label className="recurring-item-select">
                      <input
                        type="checkbox"
                        checked={checked.has(item.id)}
                        onChange={() => toggleRecurring(item.id)}
                      />
                      <span className="recurring-item-text">
                        <span className="item-title">{item.title}</span>
                        <span className="item-meta">
                          {dateToDayOfWeek(start, timezone)} {formatHHMM(start, timezone)}–
                          {formatHHMM(end, timezone)} · {categoryLabel(item.category)}
                        </span>
                      </span>
                    </label>
                    <button
                      type="button"
                      className="recurring-item-dismiss"
                      aria-label={`Don't copy ${item.title} this week`}
                      onClick={() => dismissRecurring(item.id)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={copyRecurringItems}
            disabled={loading || checked.size === 0}
          >
            {loading ? "Copying..." : "Copy checked items to this week"}
          </button>
        </div>
      </Modal>

      {!plan && (
        <div className="stack">
          <p>What do you want this week? (gaming, date night, gym...)</p>
          <div className="template-chips">
            {PRIORITY_TEMPLATES.map((phrase) => (
              <button
                key={phrase}
                type="button"
                className="template-chip"
                onClick={() => addTemplate(phrase)}
              >
                + {phrase}
              </button>
            ))}
          </div>
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


      <Modal open={Boolean(draft) && draftModalOpen} onClose={() => setDraftModalOpen(false)} title="Your week">
        {draft && (
          <div className="stack">
            <p>{draft.summary}</p>
            {draft.excludedRequests.length > 0 && (
              <div className="stack excluded-requests">
                {draft.excludedRequests.map((req, i) => (
                  <div key={i} className="excluded-request">
                    <span>
                      You asked for <strong>{req.description}</strong>, but{" "}
                      {categoryLabel(req.category)} isn&apos;t one of your selected categories.
                    </span>
                    <button
                      type="button"
                      onClick={() => addCategoryAndRegenerate(req.category, req.description)}
                      disabled={loading}
                    >
                      {loading ? "Working..." : `Add ${categoryLabel(req.category)} & regenerate`}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={approve} disabled={loading}>
              {loading ? "Working..." : "Approve this week"}
            </button>
            <div className="stack draft-adjust">
              <p className="muted">Want something different?</p>
              <textarea
                value={adjustment}
                onChange={(e) => setAdjustment(e.target.value)}
                placeholder='e.g. "move gaming to Thursday"'
                rows={2}
              />
              <button
                type="button"
                className="secondary"
                onClick={regenerate}
                disabled={loading || !adjustment.trim()}
              >
                {loading ? "Working..." : "Request changes"}
              </button>
            </div>
          </div>
        )}
      </Modal>

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
