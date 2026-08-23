"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { CheckIn, PlanItem, PlanItemStatus, Recommendation } from "@prisma/client";
import { categoryClass, categoryLabel } from "@/frontend/components/CategoryBadge";
import { CategoryLegend } from "@/frontend/components/CategoryLegend";

// See src/frontend/components/WeeklyPlanner.tsx for why date fields are
// typed as string | Date — same RSC-prop-vs-fetch-response split applies.
type ItemLike = Omit<PlanItem, "startTime"> & { startTime: string | Date };

type SubmitResult = {
  weeksOfData: number;
  sufficientData: boolean;
  missedItems: PlanItem[];
  recommendation: Recommendation | null;
};

const STATUSES: PlanItemStatus[] = ["DONE", "MISSED", "SKIPPED"];

export function CheckInScreen({
  checkIn,
  items,
}: {
  checkIn: CheckIn;
  items: ItemLike[];
}) {
  const router = useRouter();
  const [marks, setMarks] = useState<Record<string, { status: PlanItemStatus; note: string }>>(
    {},
  );
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function mark(itemId: string, status: PlanItemStatus) {
    setMarks((prev) => ({ ...prev, [itemId]: { status, note: prev[itemId]?.note ?? "" } }));
  }

  function setNote(itemId: string, note: string) {
    setMarks((prev) => ({ ...prev, [itemId]: { status: prev[itemId].status, note } }));
  }

  const allMarked = items.every((item) => marks[item.id]);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/check-in/${checkIn.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            planItemId: item.id,
            status: marks[item.id].status,
            statusNote: marks[item.id].note || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function finish() {
    setLoading(true);
    try {
      await fetch(`/api/check-in/${checkIn.id}/resolve`, { method: "POST" });
      router.push("/");
      router.refresh();
    } catch {
      setError("Couldn't finish the check-in — try again.");
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="stack checkin-result">
        {!result.sufficientData && (
          <p className="muted">
            Still learning your patterns — week {result.weeksOfData + 1} of 3 needed for
            personalized suggestions.
          </p>
        )}
        {result.recommendation ? (
          <p>{result.recommendation.content}</p>
        ) : (
          <p>Nice — you did everything you planned this week.</p>
        )}
        <button onClick={finish} disabled={loading}>
          {loading ? "Finishing..." : "Continue"}
        </button>
      </div>
    );
  }

  return (
    <div className="stack">
      <CategoryLegend />
      <ul className="item-list">
        {items.map((item, i) => (
          <li key={item.id} className={categoryClass(item.category)} style={{ "--i": i } as CSSProperties}>
            <div className="item-row">
              <span className="item-title">{item.title}</span>
            </div>
            <span className="item-meta">
              {new Date(item.startTime).toLocaleString()} · {categoryLabel(item.category)}
            </span>
            <div className="status-buttons">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  className={marks[item.id]?.status === status ? "selected" : ""}
                  onClick={() => mark(item.id, status)}
                  type="button"
                >
                  {status}
                </button>
              ))}
            </div>
            {marks[item.id] && marks[item.id].status !== "DONE" && (
              <input
                className="checkin-note"
                placeholder="Why? (optional)"
                value={marks[item.id].note}
                onChange={(e) => setNote(item.id, e.target.value)}
              />
            )}
          </li>
        ))}
      </ul>
      {error && <p className="error-text">{error}</p>}
      <button onClick={submit} disabled={loading || !allMarked}>
        {loading ? "Submitting..." : "Submit check-in"}
      </button>
    </div>
  );
}
