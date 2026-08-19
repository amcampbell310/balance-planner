import { CATEGORIES } from "@/frontend/constants";
import { categoryClass } from "@/frontend/components/CategoryBadge";

// Makes the item-list left-border colors self-explanatory instead of
// relying on memorizing an unlabeled color mapping — see conversation:
// dropping the per-item category badge (redundant with the border) only
// works if something on the page still says what each color means.
export function CategoryLegend() {
  return (
    <div className="category-legend">
      {CATEGORIES.map((c) => (
        <span key={c.value} className="category-legend-item">
          <span className={`category-legend-dot ${categoryClass(c.value)}`} aria-hidden="true" />
          {c.label}
        </span>
      ))}
    </div>
  );
}
