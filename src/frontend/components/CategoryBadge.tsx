// Shared category → color mapping (see globals.css's .cat-* custom
// properties) so every list of PlanItems — draft preview, approved week,
// check-in — codes categories the same way.
export function categoryClass(category: string): string {
  return `cat-${category.toLowerCase()}`;
}

export function CategoryBadge({ category }: { category: string }) {
  return <span className={`category-badge ${categoryClass(category)}`}>{category}</span>;
}
