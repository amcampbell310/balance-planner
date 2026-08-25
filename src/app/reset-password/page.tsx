import { ResetPasswordForm } from "@/frontend/components/ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="login-page">
      <div className="login-card">
        <h1>Reset your password</h1>
        <ResetPasswordForm token={token ?? null} />
      </div>
    </main>
  );
}
