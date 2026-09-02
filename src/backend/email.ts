import { Resend } from "resend";
import type { ReactNode } from "react";

const resend = new Resend(process.env.RESEND_API_KEY);

// balanceplanner.org verified with Resend (2026-09-02, DKIM/SPF/DMARC all
// green) — replaces the resend.dev sandbox address, which could only
// deliver to the Resend account owner's own email. Real recipients (other
// people's accounts, not just the app owner) work now.
const FROM = "Balance Planner <notifications@balanceplanner.org>";

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
