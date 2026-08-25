import Link from "next/link";

// The readable summary (/settings/export) is the primary path — a JSON
// dump is the standard data-portability format, but it's not something
// most people would ever open or get anything out of. Print/"save as PDF"
// on that page is what makes this genuinely useful without needing a new
// PDF-generation dependency.
export function DataExportSection() {
  return (
    <div className="stack">
      <h2>Your data</h2>
      <p className="muted">
        See everything you've planned, laid out by week, with a button to print or save it as a PDF.
      </p>
      <Link href="/settings/export" className="secondary">
        View my data
      </Link>
    </div>
  );
}
