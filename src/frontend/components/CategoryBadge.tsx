// Shared category → color mapping (see globals.css's .cat-* custom
// properties) so every list of PlanItems — draft preview, approved week,
// check-in — codes categories the same way.
export function categoryClass(category: string): string {
  return `cat-${category.toLowerCase()}`;
}

export function CategoryBadge({ category }: { category: string }) {
  return <span className={`category-badge ${categoryClass(category)}`}>{category}</span>;
}

// Quiet, sentence-case form for when category is shown as plain meta text
// (next to the date/time) rather than as its own colored badge.
export function categoryLabel(category: string): string {
  return category.charAt(0) + category.slice(1).toLowerCase();
}
