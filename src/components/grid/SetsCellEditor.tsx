import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CustomCellEditorProps } from "ag-grid-react";
import type { GridRow, GridSet } from "./gridModel";
import type { ExerciseType } from "../../types/exercise";
import { useSettingsStore } from "../../stores/settingsStore";
import { useProgramStore } from "../../stores/programStore";
import { useExerciseStore } from "../../stores/exerciseStore";
import { guessEquipment } from "../../lib/equipmentGuesser";
import { resolveSetWeight } from "../../lib/weightResolver";
import { formatWeight } from "../../lib/conversions";

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
  durationMin: string;
  durationSec: string;
  distance: string;
  distanceUnit: "m" | "km" | "mi" | "yd";
}

function gridSetToEditorState(
  s: GridSet | undefined,
  unitSystem: "metric" | "imperial",
): SetEditorState {
  const base: SetEditorState = {
    reps: "",
    repRangeEnd: "",
    weight: "",
    weightMode: unitSystem === "imperial" ? "lbs" : "kg",
    rpe: null,
    setType: "normal",
    durationMin: "",
    durationSec: "",
    distance: "",
    distanceUnit: unitSystem === "imperial" ? "mi" : "m",
  };

  if (!s) return base;

  let weightMode: "kg" | "lbs" | "%" =
    unitSystem === "imperial" ? "lbs" : "kg";
  let weight = "";

  if (s.percentageOfTm != null) {
    weightMode = "%";
    weight = String(Math.round(s.percentageOfTm * 100));
  } else if (s.weightKg != null) {
    if (unitSystem === "imperial") {
      const lbs = Math.round(s.weightKg * 2.20462);
      weight = String(lbs);
    } else {
      const kg = Math.round(s.weightKg * 10) / 10;
      weight = String(kg);
    }
  }

  // Duration
  let durationMin = "";
  let durationSec = "";
  if (s.durationSeconds != null) {
    const totalSec = s.durationSeconds;
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min > 0) durationMin = String(min);
    if (sec > 0 || min === 0) durationSec = String(sec);
  }

  // Distance
  let distance = "";
  let distanceUnit: SetEditorState["distanceUnit"] =
    unitSystem === "imperial" ? "mi" : "m";
  if (s.distanceMeters != null) {
    if (unitSystem === "imperial") {
      const miles = s.distanceMeters / 1609.344;
      if (miles >= 0.1) {
        distance = String(Math.round(miles * 100) / 100);
        distanceUnit = "mi";
      } else {
        distance = String(Math.round(s.distanceMeters * 1.09361));
        distanceUnit = "yd";
      }
    } else {
      if (s.distanceMeters >= 1000) {
        distance = String(Math.round(s.distanceMeters / 100) / 10);
        distanceUnit = "km";
      } else {
        distance = String(Math.round(s.distanceMeters));
        distanceUnit = "m";
      }
    }
  }

  return {
    ...base,
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
    durationMin,
    durationSec,
    distance,
    distanceUnit,
  };
}

function editorStateToGridSet(state: SetEditorState): GridSet | null {
  const reps = state.reps ? parseInt(state.reps) : null;
  const repEnd = state.repRangeEnd ? parseInt(state.repRangeEnd) : null;
  const weightVal = state.weight ? parseFloat(state.weight) : null;

  let weightKg: number | null = null;
  let percentageOfTm: number | null = null;

  if (weightVal != null) {
    if (state.weightMode === "%") {
      percentageOfTm = weightVal / 100;
    } else if (state.weightMode === "lbs") {
      weightKg = weightVal / 2.20462;
    } else {
      weightKg = weightVal;
    }
  }

  // Duration
  let durationSeconds: number | null = null;
  const min = state.durationMin ? parseInt(state.durationMin) : 0;
  const sec = state.durationSec ? parseInt(state.durationSec) : 0;
  if (min > 0 || sec > 0) durationSeconds = min * 60 + sec;

  // Distance
  let distanceMeters: number | null = null;
  const distVal = state.distance ? parseFloat(state.distance) : null;
  if (distVal != null && distVal > 0) {
    switch (state.distanceUnit) {
      case "km":
        distanceMeters = distVal * 1000;
        break;
      case "mi":
        distanceMeters = distVal * 1609.344;
        break;
      case "yd":
        distanceMeters = distVal / 1.09361;
        break;
      default:
        distanceMeters = distVal;
    }
    distanceMeters = Math.round(distanceMeters);
  }

  // Check if everything is empty
  if (
    reps == null &&
    repEnd == null &&
    weightVal == null &&
    state.rpe == null &&
    durationSeconds == null &&
    distanceMeters == null
  ) {
    return null;
  }

  return {
    setType: state.setType as GridSet["setType"],
    reps: repEnd != null ? null : reps,
    repRangeStart: repEnd != null ? reps : null,
    repRangeEnd: repEnd != null ? repEnd : null,
    weightKg,
    percentageOfTm,
    rpeTarget: state.rpe,
    durationSeconds,
    distanceMeters,
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

/** Which field groups each exercise type needs */
function getFieldsForType(exerciseType: ExerciseType): {
  reps: boolean;
  weight: boolean;
  duration: boolean;
  distance: boolean;
  rpe: boolean;
} {
  switch (exerciseType) {
    case "weight_reps":
      return { reps: true, weight: true, duration: false, distance: false, rpe: true };
    case "reps_only":
      return { reps: true, weight: false, duration: false, distance: false, rpe: true };
    case "bodyweight_reps":
      return { reps: true, weight: false, duration: false, distance: false, rpe: true };
    case "bodyweight_assisted_reps":
      return { reps: true, weight: true, duration: false, distance: false, rpe: true };
    case "duration":
      return { reps: false, weight: false, duration: true, distance: false, rpe: false };
    case "weight_duration":
      return { reps: false, weight: true, duration: true, distance: false, rpe: false };
    case "distance_duration":
      return { reps: false, weight: false, duration: true, distance: true, rpe: false };
    case "short_distance_weight":
      return { reps: false, weight: true, duration: false, distance: true, rpe: false };
    default:
      return { reps: true, weight: true, duration: false, distance: false, rpe: true };
  }
}

const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  weight_reps: "Weight & Reps",
  reps_only: "Reps Only",
  bodyweight_reps: "Bodyweight",
  bodyweight_assisted_reps: "Assisted Bodyweight",
  duration: "Duration",
  weight_duration: "Weight & Duration",
  distance_duration: "Distance & Duration",
  short_distance_weight: "Distance & Weight",
};

/**
 * Structured cell editor for sets. Adapts fields based on exercise type.
 */
export function SetsCellEditor(props: SetsCellEditorProps) {
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const minimumIncrements = useSettingsStore((s) => s.minimumIncrements);
  const defaultIncrementKg = useSettingsStore((s) => s.defaultIncrementKg);
  const resolveTm = useProgramStore((s) => s.resolveTm);
  const templates = useExerciseStore((s) => s.templates);
  const setIndex = parseInt(
    (props.colDef.field ?? "set_0").replace("set_", ""),
  );
  const row = props.data as GridRow;
  const existingSet = row?.sets[setIndex];

  // Determine exercise type
  const exerciseType: ExerciseType = useMemo(() => {
    if (!row?.exerciseTemplateId) return "weight_reps";
    const template = templates.find((t) => t.id === row.exerciseTemplateId);
    return template?.exercise_type ?? "weight_reps";
  }, [row?.exerciseTemplateId, templates]);

  const fields = getFieldsForType(exerciseType);

  const [state, setState] = useState<SetEditorState>(() =>
    gridSetToEditorState(existingSet, unitSystem),
  );

  // Resolve TM info for % mode display
  const tmInfo = useMemo(() => {
    if (state.weightMode !== "%" || !row?.exerciseTemplateId) return null;
    const tm = resolveTm(row.exerciseTemplateId);
    if (!tm) return { resolved: false as const };

    const template = templates.find((t) => t.id === row.exerciseTemplateId);
    const equipment = template?.equipment ?? guessEquipment(row.exerciseTitle);
    const pct = state.weight ? parseFloat(state.weight) / 100 : 0;

    if (pct > 0) {
      const result = resolveSetWeight(
        pct,
        tm,
        equipment,
        minimumIncrements,
        defaultIncrementKg,
        unitSystem,
      );
      const scopeLabel = tm.scope === "program" ? "Program" : "Global";
      return {
        resolved: true as const,
        tmDisplay: formatWeight(tm.training_max_kg, unitSystem),
        scope: scopeLabel,
        weightDisplay: result.weightDisplay,
      };
    }

    const scopeLabel = tm.scope === "program" ? "Program" : "Global";
    return {
      resolved: true as const,
      tmDisplay: formatWeight(tm.training_max_kg, unitSystem),
      scope: scopeLabel,
      weightDisplay: null,
    };
  }, [
    state.weightMode,
    state.weight,
    row?.exerciseTemplateId,
    row?.exerciseTitle,
    resolveTm,
    templates,
    minimumIncrements,
    defaultIncrementKg,
    unitSystem,
  ]);

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
    firstInputRef.current?.select();
  }, []);

  const update = useCallback((patch: Partial<SetEditorState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleConfirm = useCallback(() => {
    const gridSet = editorStateToGridSet(state);
    if (props.onCommit) {
      props.onCommit(row.id, setIndex, gridSet);
    }
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

  // Build inline cell summary based on exercise type
  const inlineSummary = useMemo(() => {
    const parts: string[] = [];
    if (fields.reps && state.reps) {
      parts.push(
        state.repRangeEnd
          ? `${state.reps}-${state.repRangeEnd}`
          : state.reps,
      );
    }
    if (fields.distance && state.distance) {
      parts.push(`${state.distance}${state.distanceUnit}`);
    }
    if (fields.weight && state.weight) {
      const unit = state.weightMode === "%" ? "%" : state.weightMode;
      parts.push(`${state.weight}${unit}`);
    }
    if (fields.duration && (state.durationMin || state.durationSec)) {
      const min = state.durationMin || "0";
      const sec = state.durationSec || "0";
      parts.push(`${min}:${sec.padStart(2, "0")}`);
    }
    if (fields.rpe && state.rpe != null) parts.push(`@${state.rpe}`);
    return parts.length > 0 ? parts.join(" x ") : "...";
  }, [state, fields]);

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
        {inlineSummary}
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
        {/* Exercise type indicator */}
        {exerciseType !== "weight_reps" && (
          <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", letterSpacing: "0.04em" }}>
            {EXERCISE_TYPE_LABELS[exerciseType]}
          </div>
        )}

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

        {/* Reps (weight_reps, reps_only, bodyweight variants) */}
        {fields.reps && (
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Reps</div>
              <input
                ref={firstInputRef}
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
        )}

        {/* Distance (distance_duration, short_distance_weight) */}
        {fields.distance && (
          <div>
            <div style={labelStyle}>Distance</div>
            <div style={{ display: "flex", gap: 4 }}>
              <input
                ref={!fields.reps ? firstInputRef : undefined}
                type="number"
                step="any"
                min={0}
                value={state.distance}
                onChange={(e) => update({ distance: e.target.value })}
                onKeyDown={onKeyDown}
                placeholder="0"
                style={{ ...inputStyle, flex: 1 }}
              />
              <select
                value={state.distanceUnit}
                onChange={(e) =>
                  update({
                    distanceUnit: e.target.value as SetEditorState["distanceUnit"],
                  })
                }
                style={{ ...selectStyle, width: 55, flex: "none" }}
              >
                <option value="m">m</option>
                <option value="km">km</option>
                <option value="mi">mi</option>
                <option value="yd">yd</option>
              </select>
            </div>
          </div>
        )}

        {/* Weight + mode (weight_reps, weight_duration, short_distance_weight, bodyweight_assisted) */}
        {fields.weight && (
          <div>
            <div style={labelStyle}>
              {state.weightMode === "%"
                ? "% of Training Max"
                : exerciseType === "bodyweight_assisted_reps"
                  ? "Assist Weight"
                  : "Weight"}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <input
                ref={!fields.reps && !fields.distance ? firstInputRef : undefined}
                type="number"
                step="any"
                value={state.weight}
                onChange={(e) => update({ weight: e.target.value })}
                onKeyDown={onKeyDown}
                placeholder={state.weightMode === "%" ? "85" : "0"}
                style={{ ...inputStyle, flex: 1 }}
              />
              <select
                value={state.weightMode}
                onChange={(e) => {
                  const next = e.target.value as SetEditorState["weightMode"];
                  const prev = state.weightMode;
                  const clear =
                    (prev === "%" && next !== "%") ||
                    (prev !== "%" && next === "%");
                  update({
                    weightMode: next,
                    ...(clear ? { weight: "" } : {}),
                  });
                }}
                style={{ ...selectStyle, width: 60, flex: "none" }}
              >
                <option value="kg">kg</option>
                <option value="lbs">lbs</option>
                <option value="%">%TM</option>
              </select>
            </div>
            {/* TM info line when in % mode */}
            {state.weightMode === "%" && tmInfo && (
              <div style={{ fontSize: 11, marginTop: 4 }}>
                {tmInfo.resolved ? (
                  <span style={{ color: "var(--text-secondary)" }}>
                    TM: {tmInfo.tmDisplay} ({tmInfo.scope})
                    {tmInfo.weightDisplay && (
                      <>
                        {" "}
                        = <strong>{tmInfo.weightDisplay}</strong>
                      </>
                    )}
                  </span>
                ) : (
                  <span style={{ color: "#f59e0b" }}>
                    No TM set for this exercise
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Duration (duration, weight_duration, distance_duration) */}
        {fields.duration && (
          <div>
            <div style={labelStyle}>Duration</div>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <input
                ref={!fields.reps && !fields.distance && !fields.weight ? firstInputRef : undefined}
                type="number"
                min={0}
                value={state.durationMin}
                onChange={(e) => update({ durationMin: e.target.value })}
                onKeyDown={onKeyDown}
                placeholder="0"
                style={{ ...inputStyle, flex: 1 }}
              />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                min
              </span>
              <input
                type="number"
                min={0}
                max={59}
                value={state.durationSec}
                onChange={(e) => update({ durationSec: e.target.value })}
                onKeyDown={onKeyDown}
                placeholder="0"
                style={{ ...inputStyle, flex: 1 }}
              />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                sec
              </span>
            </div>
          </div>
        )}

        {/* RPE (weight_reps, reps_only, bodyweight variants) */}
        {fields.rpe && (
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
        )}

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
