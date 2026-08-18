import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Shared sending domain until a real one is verified — see .env.example.
// Under an unverified Resend account this can only deliver to the account
// owner's own verified email, which is fine: every recipient here is the
// PlanItem/CheckIn owner, i.e. the same person running this instance.
const FROM = "Balance Planner <onboarding@resend.dev>";

export async function sendEmail(input: { to: string; subject: string; text: string }) {
  const result = await resend.emails.send({
    from: FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });

  if (result.error) {
    throw new Error(`Resend send failed: ${result.error.message}`);
  }
  return result.data;
}
