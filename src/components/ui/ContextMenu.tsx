import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuItem {
  label: string;
  onClick?: () => void;
  submenu?: ContextMenuItem[];
  isGroupHeader?: boolean;
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

function MenuPanel({
  items,
  onClose,
  style,
}: {
  items: ContextMenuItem[];
  onClose: () => void;
  style?: React.CSSProperties;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseEnterSubmenu = (index: number) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredIndex(index);
  };

  const handleMouseLeaveSubmenu = () => {
    hoverTimeoutRef.current = setTimeout(() => setHoveredIndex(null), 150);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  return (
    <div
      ref={panelRef}
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "4px 0",
        minWidth: 160,
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        ...style,
      }}
    >
      {items.map((item, i) => {
        if (item.separator) {
          return (
            <div
              key={i}
              style={{
                height: 1,
                background: "var(--border)",
                margin: "4px 0",
              }}
            />
          );
        }

        if (item.isGroupHeader) {
          return (
            <div
              key={i}
              style={{
                padding: "4px 12px 2px",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {item.label}
            </div>
          );
        }

        if (item.submenu) {
          return (
            <div
              key={i}
              style={{ position: "relative" }}
              onMouseEnter={() => handleMouseEnterSubmenu(i)}
              onMouseLeave={handleMouseLeaveSubmenu}
            >
              <button
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                  padding: "6px 12px",
                  border: "none",
                  background:
                    hoveredIndex === i ? "var(--bg-tertiary)" : "transparent",
                  color: "var(--text-primary)",
                  fontSize: 13,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                {item.label}
                <span style={{ fontSize: 10, marginLeft: 8, opacity: 0.5 }}>
                  {"\u25B6"}
                </span>
              </button>
              {hoveredIndex === i && (
                <SubmenuPanel
                  parentRef={panelRef}
                  items={item.submenu}
                  onClose={onClose}
                  rowIndex={i}
                />
              )}
            </div>
          );
        }

        return (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => {
              item.onClick?.();
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
        );
      })}
    </div>
  );
}

function SubmenuPanel({
  parentRef,
  items,
  onClose,
  rowIndex,
}: {
  parentRef: React.RefObject<HTMLDivElement | null>;
  items: ContextMenuItem[];
  onClose: () => void;
  rowIndex: number;
}) {
  const [position, setPosition] = useState<"right" | "left">("right");

  useEffect(() => {
    if (parentRef.current) {
      const rect = parentRef.current.getBoundingClientRect();
      const spaceOnRight = window.innerWidth - rect.right;
      setPosition(spaceOnRight < 180 ? "left" : "right");
    }
  }, [parentRef]);

  const topOffset = rowIndex * 32;

  return (
    <div
      style={{
        position: "absolute",
        top: Math.min(topOffset, window.innerHeight - items.length * 28 - 40),
        ...(position === "right"
          ? { left: "100%", marginLeft: -2 }
          : { right: "100%", marginRight: -2 }),
        zIndex: 1,
      }}
    >
      <MenuPanel items={items} onClose={onClose} />
    </div>
  );
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
      }}
    >
      <MenuPanel items={items} onClose={onClose} />
    </div>,
    document.body,
  );
}
