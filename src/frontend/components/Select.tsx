"use client";

import { useEffect, useRef, useState } from "react";

// Native <select> popups render with OS chrome that author CSS can't
// reliably restyle across browsers — the "bright white" look reported
// against the dark theme. This is a fully custom dropdown instead, styled
// with the same design tokens as every other control. When filterable, the
// trigger itself becomes the search field on open (a standard combobox
// pattern) rather than showing a separate search bar below it.
export function Select({
  value,
  onChange,
  options,
  filterable = false,
  placeholder = "Select...",
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; header?: boolean }>;
  filterable?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    setFilter("");
  }

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // A real value that isn't in a curated options list (e.g. a browser-
  // detected timezone outside the common set) should still display as
  // itself, not silently fall back to looking unselected.
  const selectedLabel =
    options.find((o) => !o.header && o.value === value)?.label ??
    (value ? value.replace(/_/g, " ") : placeholder);
  // Headers organize the at-rest list into sections; once actively
  // filtering, flatten to just the matches — a header with nothing left
  // under it is just noise, not a useful section boundary.
  const visibleOptions =
    filterable && filter.trim()
      ? options.filter((o) => !o.header && o.label.toLowerCase().includes(filter.toLowerCase()))
      : options;

  return (
    <div className="select-root" ref={rootRef}>
      {filterable && open ? (
        <input
          autoFocus
          className="select-trigger select-trigger-input"
          placeholder={selectedLabel}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      ) : (
        <button
          type="button"
          className="select-trigger"
          onClick={() => setOpen(filterable ? true : (prev) => !prev)}
          aria-expanded={open}
        >
          <span>{selectedLabel}</span>
          <span className="select-chevron" aria-hidden="true">
            ▾
          </span>
        </button>
      )}
      {open && (
        <div className="select-panel">
          <ul className="select-options">
            {visibleOptions.length === 0 && <li className="select-empty">No matches</li>}
            {visibleOptions.map((option) =>
              option.header ? (
                <li key={option.value} className="select-header">
                  {option.label}
                </li>
              ) : (
                <li key={option.value}>
                  <button
                    type="button"
                    className={option.value === value ? "selected" : ""}
                    onClick={() => {
                      onChange(option.value);
                      close();
                    }}
                  >
                    {option.label}
                  </button>
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
