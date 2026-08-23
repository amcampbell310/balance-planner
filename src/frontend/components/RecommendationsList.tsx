"use client";

import { useState } from "react";
import type { Recommendation } from "@prisma/client";
import { CategoryBadge, categoryClass } from "@/frontend/components/CategoryBadge";

// SSR passes real Date objects; a PATCH response goes through res.json(),
// which has no Date type — same loose typing pattern as WeeklyPlanner.tsx.
type RecommendationLike = Omit<Recommendation, "createdAt" | "respondedAt"> & {
  createdAt: string | Date;
  respondedAt: string | Date | null;
};

export function RecommendationsList({
  initialRecommendations,
}: {
  initialRecommendations: RecommendationLike[];
}) {
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [tab, setTab] = useState<"active" | "history">("active");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(id: string, status: "DISMISSED" | "ACTED_ON") {
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/recommendations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setRecommendations((prev) => prev.map((r) => (r.id === id ? data : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPendingId(null);
    }
  }

  const active = recommendations.filter((r) => r.status === "ACTIVE");
  const history = recommendations
    .filter((r) => r.status !== "ACTIVE")
    .sort((a, b) => new Date(b.respondedAt ?? 0).getTime() - new Date(a.respondedAt ?? 0).getTime());
  const shown = tab === "active" ? active : history;

  return (
    <div className="stack">
      <div className="view-toggle">
        <button
          type="button"
          className={tab === "active" ? "toggle-active" : ""}
          onClick={() => setTab("active")}
        >
          Active{active.length > 0 ? ` (${active.length})` : ""}
        </button>
        <button
          type="button"
          className={tab === "history" ? "toggle-active" : ""}
          onClick={() => setTab("history")}
        >
          History
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {shown.length === 0 ? (
        <p className="muted">
          {tab === "active"
            ? "No active recommendations right now."
            : "Nothing dismissed or acted on yet."}
        </p>
      ) : (
        <ul className="item-list">
          {shown.map((rec) => (
            <li key={rec.id} className={rec.category ? categoryClass(rec.category) : ""}>
              <div className="item-row">
                <span className="item-title">{rec.content}</span>
                <div className="item-tags">
                  {rec.category && <CategoryBadge category={rec.category} />}
                  {rec.type === "PATTERN_INSIGHT" && (
                    <span className="insight-tag">PATTERN INSIGHT</span>
                  )}
                  {rec.status !== "ACTIVE" && (
                    <span className={`status-tag status-${rec.status.toLowerCase()}`}>
                      {rec.status === "ACTED_ON" ? "ACTED ON" : rec.status}
                    </span>
                  )}
                </div>
              </div>
              <div className="item-row">
                <span className="recommendation-date">
                  {new Date(rec.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                {rec.status === "ACTIVE" && (
                  <div className="status-buttons">
                    <button
                      type="button"
                      className="secondary danger-text"
                      onClick={() => respond(rec.id, "DISMISSED")}
                      disabled={pendingId === rec.id}
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={() => respond(rec.id, "ACTED_ON")}
                      disabled={pendingId === rec.id}
                    >
                      Mark acted on
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
