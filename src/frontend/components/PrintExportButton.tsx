"use client";

// window.print() opens the browser's own print dialog, where "Save as PDF"
// is a built-in destination — see globals.css's @media print block for the
// styles that make the resulting document/PDF look right.
export function PrintExportButton() {
  return (
    <button type="button" onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}
