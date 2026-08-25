import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Karla } from "next/font/google";
import { ServiceWorkerRegistration } from "@/frontend/components/ServiceWorkerRegistration";
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

export const metadata: Metadata = {
  title: "Balance Planner",
  description:
    "A weekly planning assistant that treats social and gaming time as real commitments, not leftovers.",
  // No manual `manifest` field here — app/manifest.ts (a Next.js file
  // convention) is auto-served and auto-linked into <head> on its own.
  // iOS still needs its own vendor-prefixed tags even with a real manifest
  // (see app/manifest.ts) — Safari doesn't act on the manifest's `display`
  // field the way Chrome/Android does.
  appleWebApp: {
    title: "Balance Planner",
    statusBarStyle: "black-translucent",
  },
};

// Matches globals.css's --bg token in each theme — a home-screen/task-switcher
// chrome color should track the app's actual background, not a fixed value.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7edee" },
    { media: "(prefers-color-scheme: dark)", color: "#201316" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${karla.variable}`}>
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
