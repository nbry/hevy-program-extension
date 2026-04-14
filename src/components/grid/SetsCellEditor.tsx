import { useCallback, useEffect, useRef, useState } from "react";
import type { CustomCellEditorProps } from "ag-grid-react";
import type { GridRow, GridSet } from "./gridModel";
import { formatSet } from "./gridModel";
import { useSettingsStore } from "../../stores/settingsStore";

const SET_TYPES = ["normal", "warmup", "failure", "dropset"] as const;
const RPE_VALUES = [null, 6, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

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
      weight = String(Math.round(s.weightKg * 2.20462 * 10) / 10);
    } else {
      weight = String(Math.round(s.weightKg * 10) / 10);
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

  // If everything is empty, return null (delete the set)
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
      weightKg = Math.round((weightVal / 2.20462) * 10) / 10;
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
 * Structured cell editor for sets. Shows input fields for reps, weight, RPE, and set type
 * in a compact popup. Uses AG Grid v35 reactive custom component pattern (onValueChange).
 */
export function SetsCellEditor(props: CustomCellEditorProps) {
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

  // Notify AG Grid of current value whenever state changes
  const emitValue = useCallback(
    (s: SetEditorState) => {
      const gridSet = editorStateToGridSet(s);
      const formatted = gridSet ? formatSet(gridSet, unitSystem) : "";
      props.onValueChange(formatted);
    },
    [unitSystem, props],
  );

  useEffect(() => {
    repsRef.current?.focus();
    repsRef.current?.select();
  }, []);

  const update = useCallback(
    (patch: Partial<SetEditorState>) => {
      setState((prev) => {
        const next = { ...prev, ...patch };
        emitValue(next);
        return next;
      });
    },
    [emitValue],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        props.stopEditing(true);
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        props.stopEditing(false);
      }
    },
    [props],
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
  };

  return (
    <div
      onKeyDown={onKeyDown}
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--accent)",
        borderRadius: 6,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: 260,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      {/* Row 1: Set type */}
      <div>
        <div style={labelStyle}>Set Type</div>
        <div style={{ display: "flex", gap: 2 }}>
          {SET_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => update({ setType: t })}
              style={{
                flex: 1,
                padding: "3px 0",
                fontSize: 11,
                fontWeight: state.setType === t ? 600 : 400,
                background:
                  state.setType === t ? "var(--accent)" : "var(--bg-tertiary)",
                color: state.setType === t ? "#fff" : "var(--text-secondary)",
                border:
                  state.setType === t
                    ? "1px solid var(--accent)"
                    : "1px solid var(--border)",
                borderRadius: 4,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Row 2: Reps */}
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={labelStyle}>Reps</div>
          <input
            ref={repsRef}
            type="number"
            min={0}
            value={state.reps}
            onChange={(e) => update({ reps: e.target.value })}
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
            placeholder="e.g. 12"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Row 3: Weight + mode */}
      <div>
        <div style={labelStyle}>Weight</div>
        <div style={{ display: "flex", gap: 4 }}>
          <input
            type="number"
            step="any"
            value={state.weight}
            onChange={(e) => update({ weight: e.target.value })}
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

      {/* Row 4: RPE */}
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

      {/* Confirm hint */}
      <div
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          textAlign: "center",
        }}
      >
        Enter to confirm &middot; Esc to cancel
      </div>
    </div>
  );
}
