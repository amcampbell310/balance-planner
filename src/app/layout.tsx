import type { ReactNode } from "react";
import { Fraunces, Karla } from "next/font/google";
import "./globals.css";

// Fraunces (headings — warm, characterful serif) + Karla (body — humanist,
// legible sans) are the design system's two type roles. See globals.css for
// the rest of the "evening planner" token system (color, spacing).
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz", "SOFT", "WONK"],
});
const karla = Karla({ subsets: ["latin"], variable: "--font-body" });

export const metadata = {
  title: "Balance Planner",
  description:
    "A weekly planning assistant that treats social and gaming time as real commitments, not leftovers.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${karla.variable}`}>
      <body>{children}</body>
    </html>
  );
}
