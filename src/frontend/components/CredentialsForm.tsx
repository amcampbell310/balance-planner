"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

// The one client component in the login flow — everything else
// (LoginButtons.tsx) is server-action-based OAuth redirects with no
// validation to surface. Credentials needs real inline error feedback
// (wrong password, email taken), which is why this exists as its own
// component rather than folding into LoginButtons directly.
export function CredentialsForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      if (mode === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      }

      const result = await signIn("credentials", { email, password, redirect: false });
      if (!result?.ok) {
        throw new Error(
          mode === "signup"
            ? "Account created, but sign-in failed — try logging in below."
            : "Incorrect email or password.",
        );
      }

      // Full navigation, not just router.refresh() — the entry page's own
      // server-side gate logic (requireOnboardedUser) is what decides
      // whether this new session lands on /onboarding or /home.
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="stack credentials-form">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="error-text">{error}</p>}
      <button type="button" onClick={submit} disabled={loading || !email || !password}>
        {loading ? "Working..." : mode === "signup" ? "Create account" : "Sign in"}
      </button>
      <button
        type="button"
        className="login-link-button"
        onClick={() => {
          setMode((m) => (m === "signup" ? "login" : "signup"));
          setError(null);
        }}
        disabled={loading}
      >
        {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </div>
  );
}
