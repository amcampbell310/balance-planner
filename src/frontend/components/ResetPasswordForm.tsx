"use client";

import { useState } from "react";
import Link from "next/link";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <p className="error-text">
        This reset link is missing its token. Request a new one from the{" "}
        <Link href="/forgot-password">forgot password</Link> page.
      </p>
    );
  }

  if (done) {
    return (
      <div className="stack">
        <p className="muted">Your password has been updated.</p>
        <Link href="/" className="login-link-button">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="stack credentials-form">
      <input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <input
        type="password"
        placeholder="Confirm new password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      {error && <p className="error-text">{error}</p>}
      <button type="button" onClick={submit} disabled={loading || !password || !confirm}>
        {loading ? "Saving..." : "Reset password"}
      </button>
    </div>
  );
}
