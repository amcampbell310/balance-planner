import { Resend } from "resend";
import type { ReactNode } from "react";

const resend = new Resend(process.env.RESEND_API_KEY);

// Shared sending domain until a real one is verified — see .env.example.
// Under an unverified Resend account this can only deliver to the account
// owner's own verified email, which is fine: every recipient here is the
// PlanItem/CheckIn owner, i.e. the same person running this instance.
const FROM = "Balance Planner <onboarding@resend.dev>";

// `text` is a plain-text fallback alongside the real React Email template —
// Resend renders `react` to HTML server-side, and having both (rather than
// react alone) is better for deliverability/accessibility than HTML-only.
export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  react: ReactNode;
}) {
  const result = await resend.emails.send({
    from: FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    react: input.react,
  });

  if (result.error) {
    throw new Error(`Resend send failed: ${result.error.message}`);
  }
  return result.data;
}
