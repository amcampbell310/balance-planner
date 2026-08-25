"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

// The one modal in this codebase — everything else (drag-create,
// item-info, add-item) is a small anchored popover, which is the right
// pattern when there's a specific trigger point on screen to anchor near.
// This is different: a focused, blocking review step with no natural
// anchor point, so a centered backdrop overlay is the right shape instead.
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          {title && <h2>{title}</h2>}
          <button
            type="button"
            className="icon-button modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
