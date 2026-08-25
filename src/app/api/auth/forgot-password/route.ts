import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/backend/db";
import { sendEmail } from "@/backend/email";
import { ReminderEmail } from "@/backend/emails/ReminderEmail";
import { APP_URL } from "@/backend/jobs/shared";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const GENERIC_MESSAGE = "If an account exists for that email, we've sent instructions.";

// Always the same response whether the email is unregistered, soft-deleted,
// OAuth-only, or a real credentials account with a token now in flight —
// same "don't leak account existence" posture as the signup route's 409
// check. What actually happens (a reset email, a "use Google instead"
// email, or nothing) only ever differs internally.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email } = body as { email?: string };

  if (!email) {
    return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) {
    return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
  }

  if (!user.password) {
    // OAuth-only account — there's no password to reset. Silently doing
    // nothing would leave a real person stuck wondering why no email
    // arrived, so tell them how they actually sign in instead. A delivery
    // failure here (see the try/catch below) must still fall through to the
    // same generic response — surfacing it would leak that this email is
    // registered.
    try {
      await sendEmail({
        to: email,
        subject: "Sign in to Balance Planner",
        text: `You (or someone) requested a password reset, but this account signs in with Google, not a password. Head to ${APP_URL} and use "Continue with Google" instead.`,
        react: ReminderEmail({
          preview: "This account signs in with Google",
          heading: "You sign in with Google",
          body: 'You requested a password reset for this email, but this account was created with Google sign-in and has no password to reset. Head back to Balance Planner and use "Continue with Google" instead.',
          ctaLabel: "Go to Balance Planner",
          ctaHref: APP_URL,
          footer:
            "You're getting this because someone requested a password reset for this email at Balance Planner. If that wasn't you, you can ignore it.",
        }),
      });
    } catch (err) {
      console.error("forgot-password: failed to send OAuth-account notice", err);
    }
    return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");

  // At most one valid token per user — a fresh request invalidates any
  // earlier one instead of letting several stay valid at once.
  await db.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${APP_URL}/reset-password?token=${rawToken}`;
  // A delivery failure (provider outage, sandbox restrictions, etc.) must
  // not surface as anything other than the same generic response — the
  // token already exists and simply expires unused in that case, same as
  // any token nobody clicks.
  try {
    await sendEmail({
      to: email,
      subject: "Reset your Balance Planner password",
      text: `Reset your password: ${resetUrl} (expires in 1 hour). If you didn't request this, you can ignore this email.`,
      react: ReminderEmail({
        preview: "Reset your Balance Planner password",
        heading: "Reset your password",
        body: "We got a request to reset your Balance Planner password. This link expires in 1 hour and works once.",
        ctaLabel: "Reset password",
        ctaHref: resetUrl,
        footer:
          "You're getting this because someone requested a password reset for this email. If that wasn't you, you can safely ignore it — your password won't change.",
      }),
    });
  } catch (err) {
    console.error("forgot-password: failed to send reset email", err);
  }

  return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
}
