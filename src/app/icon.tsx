import { ImageResponse } from "next/og";

// Next.js file convention — auto-served at /icon and auto-linked into every
// page's <head>, closing a real gap: this app had no browser-tab favicon at
// all before. Same mark and colors as the PWA install icons
// (scripts/generate-pwa-icons.tsx / app/manifest.ts), generated rather than
// hand-drawn, one shared visual identity rather than a separate asset.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#201316",
        }}
      >
        <div style={{ fontSize: 22, fontFamily: "Georgia, serif", fontWeight: 700, color: "#d4708c" }}>
          B
        </div>
      </div>
    ),
    { ...size },
  );
}
