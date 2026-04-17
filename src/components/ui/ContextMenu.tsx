import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClose = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClose);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", handleClose);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  // Clamp to viewport
  const left = Math.min(x, window.innerWidth - 200);
  const top = Math.min(y, window.innerHeight - items.length * 32 - 16);

  return createPortal(
    <div
      ref={ref}
      style={{
        position: "fixed",
        left,
        top,
        zIndex: 9999,
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "4px 0",
        minWidth: 160,
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      }}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div
            key={i}
            style={{
              height: 1,
              background: "var(--border)",
              margin: "4px 0",
            }}
          />
        ) : (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            style={{
              display: "block",
              width: "100%",
              padding: "6px 12px",
              border: "none",
              background: "transparent",
              color: item.danger
                ? "#ef4444"
                : item.disabled
                  ? "var(--text-muted)"
                  : "var(--text-primary)",
              fontSize: 13,
              textAlign: "left",
              cursor: item.disabled ? "default" : "pointer",
              opacity: item.disabled ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!item.disabled)
                e.currentTarget.style.background = "var(--bg-tertiary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            {item.label}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}
