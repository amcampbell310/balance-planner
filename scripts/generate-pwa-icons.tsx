import { writeFileSync, mkdirSync } from "fs";
import { ImageResponse } from "next/og";

// One-off generator, not a live route — PWA install icons never change at
// runtime, so there's no reason to regenerate them on every request the way
// app/icon.tsx (the browser-tab favicon) does. Run with `npx tsx
// scripts/generate-pwa-icons.ts` and commit the resulting PNGs; re-run only
// if the mark itself changes.
//
// Colors match globals.css's dark theme (--bg / --accent) — a home-screen
// icon needs its own fixed background regardless of the viewer's OS theme,
// and the dark plum-on-pink pairing is this app's actual, already-settled
// visual identity, not a new one invented for this icon.
const BG = "#201316";
const ACCENT = "#d4708c";

function icon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BG,
        }}
      >
        {/* Generous padding around the glyph — keeps it inside the safe
            zone Android's adaptive-icon masks (circle, squircle, rounded
            square) crop to, so nothing important gets clipped. */}
        <div
          style={{
            fontSize: size * 0.52,
            fontFamily: "Georgia, serif",
            fontWeight: 700,
            color: ACCENT,
            lineHeight: 1,
          }}
        >
          B
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}

async function main() {
  mkdirSync("public/icons", { recursive: true });
  for (const size of [192, 512]) {
    const response = icon(size);
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(`public/icons/icon-${size}.png`, buffer);
    console.log(`wrote public/icons/icon-${size}.png (${buffer.length} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
