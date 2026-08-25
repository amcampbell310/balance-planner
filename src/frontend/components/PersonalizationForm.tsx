"use client";

import { useState } from "react";

export function PersonalizationForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
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
      <h2>Personalization</h2>
      <div>
        <label>
          First name
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            placeholder="First name"
          />
        </label>
      </div>

      {error && <p className="error-text">{error}</p>}
      {saved && !error && <p className="muted">Saved.</p>}

      <button onClick={submit} disabled={loading || !name.trim() || name.trim() === initialName}>
        {loading ? "Saving..." : "Save changes"}
      </button>
    </div>
  );
}
