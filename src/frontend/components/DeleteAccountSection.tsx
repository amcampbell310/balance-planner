"use client";

import { useState } from "react";

// Two-step confirmation rather than a single click or a native
// window.confirm() popup — this is a real, if soft, destructive action and
// deserves a deliberate second step styled consistently with the rest of
// the app rather than a jarring browser dialog.
export function DeleteAccountSection() {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Something went wrong");
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <h2>Delete account</h2>
      <p className="muted">
        Your account and data will stop being accessible immediately. This can't be undone from
        within the app.
      </p>
      {error && <p className="error-text">{error}</p>}
      {confirming ? (
        <div className="status-buttons">
          <button onClick={deleteAccount} disabled={loading} className="danger">
            {loading ? "Deleting..." : "Yes, delete my account"}
          </button>
          <button onClick={() => setConfirming(false)} disabled={loading} className="secondary">
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} className="secondary danger-text">
          Delete my account
        </button>
      )}
    </div>
  );
}
