// Shared between src/app/api/auth/signup/route.ts (new account) and
// src/app/api/auth/reset-password/route.ts (new password) — the same rule
// enforced in both places, not just documented once.
export const MIN_PASSWORD_LENGTH = 8;

export function passwordError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}
