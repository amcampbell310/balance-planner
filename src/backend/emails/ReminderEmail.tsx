import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";

// Hand-picked from globals.css's light theme — email clients can't read CSS
// custom properties, and dark-mode email support is inconsistent enough
// across clients that this deliberately targets the light palette only,
// same as most transactional email. Fraunces/Karla (the app's actual
// fonts) aren't safe to assume are installed on an arbitrary email client,
// so headings fall back to a generic serif and body text to the same
// system-sans stack globals.css already uses as Karla's own fallback.
const COLORS = {
  bg: "#f7edee",
  surface: "#fbf5f6",
  border: "#e4d0d3",
  text: "#33191d",
  textMuted: "#8c6e71",
  accent: "#9a364f",
  accentContrast: "#fdf3f4",
};

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

// One reusable shell for every reminder type (check-in, draft-pending,
// re-engagement) rather than three near-identical templates — they only
// ever differ by heading/body/CTA copy, never by structure.
export function ReminderEmail({
  preview,
  heading,
  body,
  ctaLabel,
  ctaHref,
}: {
  preview: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: COLORS.bg, fontFamily: SANS, margin: 0, padding: "32px 16px" }}>
        <Container
          style={{
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            padding: "32px 36px",
            maxWidth: 480,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: COLORS.accent,
              margin: "0 0 8px",
            }}
          >
            Balance Planner
          </Text>
          <Heading style={{ fontFamily: SERIF, fontSize: 22, color: COLORS.text, margin: "0 0 16px" }}>
            {heading}
          </Heading>
          <Text style={{ fontSize: 15, lineHeight: "1.6", color: COLORS.text, margin: "0 0 28px" }}>
            {body}
          </Text>
          <Button
            href={ctaHref}
            style={{
              backgroundColor: COLORS.accent,
              color: COLORS.accentContrast,
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 8,
              padding: "12px 22px",
              textDecoration: "none",
            }}
          >
            {ctaLabel}
          </Button>
          <Hr style={{ borderColor: COLORS.border, margin: "32px 0 16px" }} />
          <Text style={{ fontSize: 12, color: COLORS.textMuted, margin: 0 }}>
            You&apos;re getting this because you have reminders on in Balance Planner. Manage that
            anytime from Settings.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
