import type { MetadataRoute } from "next";

// Next.js file convention — auto-served and auto-linked into every page's
// <head>, no manual <link rel="manifest"> needed (see layout.tsx). Icons are
// pre-generated static PNGs (scripts/generate-pwa-icons.tsx), not rendered
// on every request — a PWA install icon never changes at runtime.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Balance Planner",
    short_name: "Balance Planner",
    description:
      "A weekly planning assistant that treats social and gaming time as real commitments, not leftovers.",
    // "/" not "/home" — the entry page's own logic already decides where a
    // given session should land (login screen, onboarding, or home), which
    // a fixed start_url shouldn't try to second-guess for a signed-out or
    // not-yet-onboarded install.
    start_url: "/",
    display: "standalone",
    background_color: "#201316",
    theme_color: "#201316",
    // The glyph has generous safe-zone padding (see the generator script),
    // so the same two PNGs can honestly serve both purposes — listed twice
    // each rather than once, since Next's manifest type only accepts a
    // single `purpose` literal per entry, not the spec's space-separated
    // multi-value string form.
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
