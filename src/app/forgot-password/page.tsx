import Link from "next/link";
import { ForgotPasswordForm } from "@/frontend/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="login-page">
      <div className="login-card">
        <h1>Reset your password</h1>
        <ForgotPasswordForm />
        <Link href="/" className="login-link-button">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
