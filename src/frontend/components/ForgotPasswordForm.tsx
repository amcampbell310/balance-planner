"use client";

import { useState } from "react";

// The API always responds with the same generic message regardless of
// whether the email is registered (see src/app/api/auth/forgot-password/route.ts)
// — so there's nothing case-specific to branch on here, just a single
// success state once the request completes.
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Something went wrong");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return <p className="muted">If an account exists for that email, we&apos;ve sent instructions.</p>;
  }

  return (
    <div className="stack credentials-form">
      <p className="login-tagline">Enter your email and we&apos;ll send you a reset link.</p>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {error && <p className="error-text">{error}</p>}
      <button type="button" onClick={submit} disabled={loading || !email}>
        {loading ? "Sending..." : "Send reset link"}
      </button>
    </div>
  );
}
