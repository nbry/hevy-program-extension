import { useCallback, useEffect, useRef, useState } from "react";
import type { CustomCellEditorProps } from "ag-grid-react";
import type { GridRow, GridSet } from "./gridModel";
import { useSettingsStore } from "../../stores/settingsStore";

const SET_TYPES = ["normal", "warmup", "failure", "dropset"] as const;
const RPE_VALUES = [null, 6, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

const SET_TYPE_COLORS: Record<string, string> = {
  normal: "var(--accent)",
  warmup: "#f59e0b",
  failure: "#ef4444",
  dropset: "#a855f7",
};

interface SetEditorState {
  reps: string;
  repRangeEnd: string;
  weight: string;
  weightMode: "kg" | "lbs" | "%";
  rpe: number | null;
  setType: string;
}

function gridSetToEditorState(
  s: GridSet | undefined,
  unitSystem: "metric" | "imperial",
): SetEditorState {
  if (!s) {
    return {
      reps: "",
      repRangeEnd: "",
      weight: "",
      weightMode: unitSystem === "imperial" ? "lbs" : "kg",
      rpe: null,
      setType: "normal",
    };
  }

  let weightMode: "kg" | "lbs" | "%" = unitSystem === "imperial" ? "lbs" : "kg";
  let weight = "";

  if (s.percentageOfTm != null) {
    weightMode = "%";
    weight = String(Math.round(s.percentageOfTm * 100));
  } else if (s.weightKg != null) {
    if (unitSystem === "imperial") {
      const lbs = Math.round(s.weightKg * 2.20462 * 100) / 100;
      weight = String(Number.isInteger(lbs) ? lbs : parseFloat(lbs.toFixed(1)));
    } else {
      const kg = Math.round(s.weightKg * 100) / 100;
      weight = String(Number.isInteger(kg) ? kg : parseFloat(kg.toFixed(1)));
    }
  }

  return {
    reps:
      s.repRangeStart != null
        ? String(s.repRangeStart)
        : s.reps != null
          ? String(s.reps)
          : "",
    repRangeEnd: s.repRangeEnd != null ? String(s.repRangeEnd) : "",
    weight,
    weightMode,
    rpe: s.rpeTarget,
    setType: s.setType,
  };
}

function editorStateToGridSet(state: SetEditorState): GridSet | null {
  const reps = state.reps ? parseInt(state.reps) : null;
  const repEnd = state.repRangeEnd ? parseInt(state.repRangeEnd) : null;
  const weightVal = state.weight ? parseFloat(state.weight) : null;

  if (
    reps == null &&
    repEnd == null &&
    weightVal == null &&
    state.rpe == null
  ) {
    return null;
  }

  let weightKg: number | null = null;
  let percentageOfTm: number | null = null;

  if (weightVal != null) {
    if (state.weightMode === "%") {
      percentageOfTm = weightVal / 100;
    } else if (state.weightMode === "lbs") {
      weightKg = Math.round((weightVal / 2.20462) * 10000) / 10000;
    } else {
      weightKg = weightVal;
    }
  }

  return {
    setType: state.setType as GridSet["setType"],
    reps: repEnd != null ? null : reps,
    repRangeStart: repEnd != null ? reps : null,
    repRangeEnd: repEnd != null ? repEnd : null,
    weightKg,
    percentageOfTm,
    rpeTarget: state.rpe,
  };
}

/**
 * Callback passed via cellEditorParams to directly update the row state,
 * bypassing AG Grid's value pipeline entirely.
 */
export type SetCommitFn = (
  rowId: string,
  setIdx: number,
  gridSet: GridSet | null,
) => void;

interface SetsCellEditorProps extends CustomCellEditorProps {
  onCommit?: SetCommitFn;
}

/**
 * Structured cell editor for sets. Renders inline with an absolute-positioned
 * form panel below. On confirm, directly updates row state via onCommit callback
 * (bypasses AG Grid's value pipeline which is broken for popup editors in v35).
 */
export function SetsCellEditor(props: SetsCellEditorProps) {
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const setIndex = parseInt(
    (props.colDef.field ?? "set_0").replace("set_", ""),
  );
  const row = props.data as GridRow;
  const existingSet = row?.sets[setIndex];

  const [state, setState] = useState<SetEditorState>(() =>
    gridSetToEditorState(existingSet, unitSystem),
  );

  const repsRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    repsRef.current?.focus();
    repsRef.current?.select();
  }, []);

  const update = useCallback(
    (patch: Partial<SetEditorState>) => {
      setState((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    const gridSet = editorStateToGridSet(state);
    if (props.onCommit) {
      props.onCommit(row.id, setIndex, gridSet);
    }
    // Cancel=true: we already updated state directly via onCommit,
    // so tell AG Grid not to process any value through its pipeline.
    props.stopEditing(true);
  }, [state, props, row.id, setIndex]);

  const handleCancel = useCallback(() => {
    props.stopEditing(true);
  }, [props]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel();
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleConfirm();
      }
    },
    [handleConfirm, handleCancel],
  );

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 2,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "4px 6px",
    fontSize: 13,
    background: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    outline: "none",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: "pointer",
    appearance: "auto" as const,
    backgroundColor: "var(--bg-tertiary)",
    color: "var(--text-primary)",
  };

  const activeColor = SET_TYPE_COLORS[state.setType] ?? "var(--accent)";

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Inline cell: show summary of current edit */}
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          fontSize: 13,
          background: "var(--bg-tertiary)",
          color: "var(--text-primary)",
          border: "1px solid var(--accent)",
          boxSizing: "border-box",
          cursor: "text",
        }}
      >
        {(() => {
          const parts: string[] = [];
          if (state.reps) {
            parts.push(state.repRangeEnd ? `${state.reps}-${state.repRangeEnd}` : state.reps);
          }
          if (state.weight) {
            const unit = state.weightMode === "%" ? "%" : state.weightMode;
            parts.push(`${state.weight}${unit}`);
          }
          if (state.rpe != null) parts.push(`@${state.rpe}`);
          return parts.length > 0 ? parts.join(" x ") : "...";
        })()}
      </div>

      {/* Absolute-positioned form panel below */}
      <div
        onKeyDown={onKeyDown}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: "100%",
          left: 0,
          background: "var(--bg-secondary)",
          border: `1px solid ${activeColor}`,
          borderRadius: 6,
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          width: 260,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          zIndex: 1000,
        }}
      >
        {/* Set type */}
        <div>
          <div style={labelStyle}>Set Type</div>
          <div style={{ display: "flex", gap: 2 }}>
            {SET_TYPES.map((t) => {
              const color = SET_TYPE_COLORS[t];
              const isActive = state.setType === t;
              return (
                <button
                  key={t}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => update({ setType: t })}
                  style={{
                    flex: 1,
                    padding: "3px 0",
                    fontSize: 11,
                    fontWeight: isActive ? 600 : 400,
                    background: isActive ? color : "var(--bg-tertiary)",
                    color: isActive ? "#fff" : "var(--text-secondary)",
                    border: isActive
                      ? `1px solid ${color}`
                      : "1px solid var(--border)",
                    borderRadius: 4,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Reps */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Reps</div>
            <input
              ref={repsRef}
              type="number"
              min={0}
              value={state.reps}
              onChange={(e) => update({ reps: e.target.value })}
              onKeyDown={onKeyDown}
              placeholder="5"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Rep Range End</div>
            <input
              type="number"
              min={0}
              value={state.repRangeEnd}
              onChange={(e) => update({ repRangeEnd: e.target.value })}
              onKeyDown={onKeyDown}
              placeholder="e.g. 12"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Weight + mode */}
        <div>
          <div style={labelStyle}>Weight</div>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              type="number"
              step="any"
              value={state.weight}
              onChange={(e) => update({ weight: e.target.value })}
              onKeyDown={onKeyDown}
              placeholder="0"
              style={{ ...inputStyle, flex: 1 }}
            />
            <select
              value={state.weightMode}
              onChange={(e) =>
                update({
                  weightMode: e.target.value as SetEditorState["weightMode"],
                })
              }
              style={{ ...selectStyle, width: 60, flex: "none" }}
            >
              <option value="kg">kg</option>
              <option value="lbs">lbs</option>
              <option value="%">%TM</option>
            </select>
          </div>
        </div>

        {/* RPE */}
        <div>
          <div style={labelStyle}>RPE Target</div>
          <select
            value={state.rpe ?? ""}
            onChange={(e) =>
              update({
                rpe: e.target.value ? parseFloat(e.target.value) : null,
              })
            }
            style={selectStyle}
          >
            <option value="">None</option>
            {RPE_VALUES.filter((v) => v !== null).map((v) => (
              <option key={v} value={v}>
                RPE {v}
              </option>
            ))}
          </select>
        </div>

        {/* Confirm / Cancel */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleConfirm}
            style={{
              flex: 1,
              padding: "5px 0",
              fontSize: 12,
              fontWeight: 600,
              background: activeColor,
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Confirm
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleCancel}
            style={{
              padding: "5px 12px",
              fontSize: 12,
              fontWeight: 500,
              background: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
