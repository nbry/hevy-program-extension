import { useCallback, useEffect, useRef, useState } from "react";
import type { CustomCellEditorProps } from "ag-grid-react";
import { useExerciseStore } from "../../stores/exerciseStore";

/**
 * Custom AG Grid cell editor with typeahead autocomplete for exercise names.
 * Uses AG Grid v35 reactive custom component pattern (onValueChange).
 */
export function ExerciseNameEditor(props: CustomCellEditorProps) {
  const search = useExerciseStore((s) => s.search);
  const [query, setQuery] = useState(props.value ?? "");
  const [results, setResults] = useState(() => search(props.value ?? ""));
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const updateQuery = useCallback(
    (text: string) => {
      setQuery(text);
      props.onValueChange(text);
      const matches = search(text);
      setResults(matches);
      setHighlightIndex(0);
    },
    [search, props],
  );

  const confirmSelection = useCallback(
    (title: string) => {
      setQuery(title);
      props.onValueChange(title);
      setTimeout(() => props.stopEditing(false), 0);
    },
    [props],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (results[highlightIndex]) {
          confirmSelection(results[highlightIndex].title);
        } else if (query.trim()) {
          props.stopEditing(false);
        }
      } else if (e.key === "Escape") {
        props.stopEditing(true);
      } else if (e.key === "Tab") {
        if (results[highlightIndex]) {
          confirmSelection(results[highlightIndex].title);
        } else {
          props.stopEditing(false);
        }
      }
    },
    [results, highlightIndex, confirmSelection, props, query],
  );

  // Scroll highlighted item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[highlightIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
      }}
    >
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => updateQuery(e.target.value)}
        onKeyDown={onKeyDown}
        style={{
          width: "100%",
          height: "100%",
          padding: "0 12px",
          background: "var(--bg-tertiary)",
          color: "var(--text-primary)",
          border: "1px solid var(--accent)",
          borderRadius: 0,
          fontSize: 13,
          fontWeight: 500,
          outline: "none",
          boxSizing: "border-box",
        }}
        spellCheck={false}
      />
      {results.length > 0 && (
        <div
          ref={listRef}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            width: 320,
            maxHeight: 240,
            overflow: "auto",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderTop: "none",
            borderRadius: "0 0 6px 6px",
            zIndex: 1000,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          {results.map((t, i) => (
            <div
              key={t.id}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur
                confirmSelection(t.title);
              }}
              onMouseEnter={() => setHighlightIndex(i)}
              style={{
                padding: "6px 12px",
                fontSize: 13,
                cursor: "pointer",
                background:
                  i === highlightIndex ? "var(--bg-hover)" : "transparent",
                color:
                  i === highlightIndex
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {t.title}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {t.primary_muscle_group}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
