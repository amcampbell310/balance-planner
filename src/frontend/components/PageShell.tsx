import type { ReactNode } from "react";

// Shared page chrome — every route in src/app renders its content through
// this rather than repeating layout markup. Lives in src/frontend because
// it's pure UI: no data fetching, no auth checks, no backend imports.
export function PageShell({
  title,
  wide = false,
  centerTitle = false,
  children,
}: {
  title: string;
  wide?: boolean;
  centerTitle?: boolean;
  children: ReactNode;
}) {
  return (
    <main className={`page-shell${wide ? " wide" : ""}`}>
      <h1 className={centerTitle ? "text-center" : undefined}>{title}</h1>
      {children}
    </main>
  );
}
