import { signIn } from "@/backend/auth";

// Server Component using server actions — no client JS needed for login
// itself. Provider ids match diagrams/onboarding-flow.mmd and
// diagrams/user-flow.mmd: Google, Microsoft, Apple, nothing else.
export function LoginButtons() {
  return (
    <div className="login-buttons">
      <form
        action={async () => {
          "use server";
          await signIn("google");
        }}
      >
        <button type="submit">Continue with Google</button>
      </form>
      <form
        action={async () => {
          "use server";
          await signIn("microsoft-entra-id");
        }}
      >
        <button type="submit">Continue with Microsoft</button>
      </form>
      <form
        action={async () => {
          "use server";
          await signIn("apple");
        }}
      >
        <button type="submit">Continue with Apple</button>
      </form>
    </div>
  );
}
