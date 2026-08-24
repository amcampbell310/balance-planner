import { signIn } from "@/backend/auth";
import { GoogleIcon } from "@/frontend/components/GoogleIcon";
import { CredentialsForm } from "@/frontend/components/CredentialsForm";

// Credentials is the primary path (form first) — Google is a server-action
// button below it, styled to Google's own brand convention (white,
// bordered, the real multi-color "G" mark) rather than the app's accent
// color, since a branded sign-in button isn't supposed to be re-themed.
// Microsoft/Apple buttons were removed entirely (not just left unused) —
// see src/backend/auth.ts's provider-filter comment for why those were
// declined; showing buttons for providers Auth.js doesn't actually have
// registered would be a dead end, not just an unbuilt one.
export function LoginButtons() {
  return (
    <div className="stack login-buttons">
      <CredentialsForm />

      <div className="login-divider">
        <span>or</span>
      </div>

      <form
        action={async () => {
          "use server";
          await signIn("google");
        }}
      >
        <button type="submit" className="google-button">
          <GoogleIcon />
          Continue with Google
        </button>
      </form>
    </div>
  );
}
