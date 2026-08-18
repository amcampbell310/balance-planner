import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Balance Planner",
  description:
    "A weekly planning assistant that treats social and gaming time as real commitments, not leftovers.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
