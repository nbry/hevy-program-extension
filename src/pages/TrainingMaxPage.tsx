import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { useProgramStore } from "../stores/programStore";
import { useExerciseStore } from "../stores/exerciseStore";
import { useSettingsStore } from "../stores/settingsStore";
import { formatWeight, parseWeightToKg } from "../lib/conversions";
import * as api from "../lib/tauri";
import type {
  GlobalTrainingMax,
  TrainingMax,
  ExerciseTemplate,
} from "../types";

const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  machine: "Machine",
  kettlebell: "Kettlebell",
  plate: "Plate",
  other: "Other",
  none: "None",
  resistance_band: "Band",
  suspension: "Suspension",
};

export function TrainingMaxPage() {
  const [searchParams] = useSearchParams();
  const programId = searchParams.get("programId");

  const {
    activeProgram,
    trainingMaxes,
    globalTrainingMaxes,
    loadTrainingMaxes,
    loadGlobalTrainingMaxes,
  } = useProgramStore();
  const { templates } = useExerciseStore();
  const { unitSystem } = useSettingsStore();

  const [tab, setTab] = useState<"global" | "program">(
    programId ? "program" : "global",
  );
  const [addingExercise, setAddingExercise] = useState(false);

  // Reload TMs on mount
  useEffect(() => {
    loadGlobalTrainingMaxes();
    if (activeProgram) loadTrainingMaxes();
  }, [loadGlobalTrainingMaxes, loadTrainingMaxes, activeProgram]);

  const hasProgramContext = !!activeProgram && !!programId;

  // Build exercise lookup map
  const exerciseMap = useMemo(() => {
    const map = new Map<string, ExerciseTemplate>();
    for (const t of templates) map.set(t.id, t);
    return map;
  }, [templates]);

  // Global TMs as sorted array
  const globalTmList = useMemo(() => {
    const list = Array.from(globalTrainingMaxes.values());
    list.sort((a, b) => {
      const aTitle = exerciseMap.get(a.exercise_template_id)?.title ?? "";
      const bTitle = exerciseMap.get(b.exercise_template_id)?.title ?? "";
      return aTitle.localeCompare(bTitle);
    });
    return list;
  }, [globalTrainingMaxes, exerciseMap]);

  // Program TMs as sorted array
  const programTmList = useMemo(() => {
    const list = Array.from(trainingMaxes.values());
    list.sort((a, b) => {
      const aTitle = exerciseMap.get(a.exercise_template_id)?.title ?? "";
      const bTitle = exerciseMap.get(b.exercise_template_id)?.title ?? "";
      return aTitle.localeCompare(bTitle);
    });
    return list;
  }, [trainingMaxes, exerciseMap]);

  return (
    <div
      style={{
        maxWidth: 700,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Training Maxes</h2>
        {hasProgramContext && (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {activeProgram.name}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setAddingExercise(true)}
        >
          + Add TM
        </button>
      </div>

      {/* Tabs */}
      {hasProgramContext && (
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          <button
            className={`btn btn-sm ${tab === "global" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setTab("global")}
          >
            Global
          </button>
          <button
            className={`btn btn-sm ${tab === "program" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setTab("program")}
          >
            Program Overrides
          </button>
        </div>
      )}

      {addingExercise && (
        <AddTrainingMaxRow
          tab={tab}
          programId={hasProgramContext ? activeProgram.id : null}
          existingGlobalIds={
            new Set(globalTmList.map((t) => t.exercise_template_id))
          }
          existingProgramIds={
            new Set(programTmList.map((t) => t.exercise_template_id))
          }
          unitSystem={unitSystem}
          onClose={() => setAddingExercise(false)}
          onAdded={() => {
            setAddingExercise(false);
            if (tab === "global") loadGlobalTrainingMaxes();
            else loadTrainingMaxes();
          }}
        />
      )}

      {/* TM List */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {tab === "global" ? (
          <GlobalTmTable
            items={globalTmList}
            exerciseMap={exerciseMap}
            unitSystem={unitSystem}
            hasProgramContext={hasProgramContext}
            programTmIds={
              new Set(programTmList.map((t) => t.exercise_template_id))
            }
            onReload={loadGlobalTrainingMaxes}
            onCreateOverride={async (exerciseId) => {
              if (!activeProgram) return;
              const globalTm = globalTrainingMaxes.get(exerciseId);
              if (!globalTm) return;
              try {
                await api.setTrainingMax(
                  activeProgram.id,
                  exerciseId,
                  globalTm.training_max_kg,
                  undefined,
                  "manual",
                );
                await loadTrainingMaxes();
                setTab("program");
                toast.success("Program override created");
              } catch (e) {
                toast.error(`Failed: ${e}`);
              }
            }}
          />
        ) : (
          <ProgramTmTable
            items={programTmList}
            exerciseMap={exerciseMap}
            unitSystem={unitSystem}
            globalTmMap={globalTrainingMaxes}
            onReload={loadTrainingMaxes}
            programId={activeProgram!.id}
          />
        )}
      </div>
    </div>
  );
}

/* ──── Shared grid template ──── */

const GLOBAL_GRID = "1fr 120px 80px";
const PROGRAM_GRID = "1fr 120px 120px 80px";

/* ──────────────────── Global TM Table ──────────────────── */

function GlobalTmTable({
  items,
  exerciseMap,
  unitSystem,
  hasProgramContext,
  programTmIds,
  onReload,
  onCreateOverride,
}: {
  items: GlobalTrainingMax[];
  exerciseMap: Map<string, ExerciseTemplate>;
  unitSystem: string;
  hasProgramContext: boolean;
  programTmIds: Set<string>;
  onReload: () => Promise<void>;
  onCreateOverride: (exerciseId: string) => Promise<void>;
}) {
  if (items.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: 13,
        }}
      >
        No global training maxes set. Click &quot;+ Add TM&quot; to add one.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: GLOBAL_GRID,
          gap: 8,
          padding: "6px 8px",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span>Exercise</span>
        <span>Training Max</span>
        <span />
      </div>

      {items.map((tm) => (
        <GlobalTmRow
          key={tm.id}
          tm={tm}
          exercise={exerciseMap.get(tm.exercise_template_id)}
          unitSystem={unitSystem}
          hasProgramContext={hasProgramContext}
          hasOverride={programTmIds.has(tm.exercise_template_id)}
          onReload={onReload}
          onCreateOverride={onCreateOverride}
        />
      ))}
    </div>
  );
}

function GlobalTmRow({
  tm,
  exercise,
  unitSystem,
  hasProgramContext,
  hasOverride,
  onReload,
  onCreateOverride,
}: {
  tm: GlobalTrainingMax;
  exercise: ExerciseTemplate | undefined;
  unitSystem: string;
  hasProgramContext: boolean;
  hasOverride: boolean;
  onReload: () => Promise<void>;
  onCreateOverride: (exerciseId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const unit = unitSystem as "metric" | "imperial";
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = async () => {
    const num = parseFloat(editValue);
    if (isNaN(num) || num <= 0) {
      setEditing(false);
      return;
    }
    const kg = parseWeightToKg(num, unit);
    try {
      await api.setGlobalTrainingMax(
        tm.exercise_template_id,
        kg,
        undefined,
        "manual",
      );
      await onReload();
      toast.success("TM updated");
    } catch (e) {
      toast.error(`Failed: ${e}`);
    }
    setEditing(false);
  };

  const handleDelete = async () => {
    if (
      !confirm(`Remove global TM for "${exercise?.title ?? "this exercise"}"?`)
    )
      return;
    try {
      await api.deleteGlobalTrainingMax(tm.exercise_template_id);
      await onReload();
      toast.success("TM removed");
    } catch (e) {
      toast.error(`Failed: ${e}`);
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: GLOBAL_GRID,
        gap: 8,
        padding: "6px 8px",
        alignItems: "center",
        fontSize: 13,
        borderBottom: "1px solid var(--border-subtle, rgba(255,255,255,0.05))",
      }}
    >
      {/* Exercise name */}
      <span title={exercise?.title}>
        {exercise?.title ?? tm.exercise_template_id}
      </span>

      {/* Training Max */}
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          step="any"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") setEditing(false);
          }}
          style={{
            width: "100%",
            fontSize: 13,
            padding: "2px 6px",
            background: "var(--bg-tertiary)",
            border: "1px solid var(--accent)",
            borderRadius: 4,
            color: "var(--text-primary)",
          }}
        />
      ) : (
        <span
          style={{ cursor: "pointer", fontWeight: 500 }}
          onClick={() => {
            setEditing(true);
            setEditValue(displayWeightRaw(tm.training_max_kg, unit));
          }}
          title="Click to edit"
        >
          {formatWeight(tm.training_max_kg, unit)}
        </span>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
        {hasProgramContext && !hasOverride && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onCreateOverride(tm.exercise_template_id)}
            title="Create a program-specific override"
            style={{ fontSize: 11, padding: "2px 6px" }}
          >
            Override
          </button>
        )}
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleDelete}
          title="Delete"
          style={{ fontSize: 11, padding: "2px 6px", color: "var(--error)" }}
        >
          &times;
        </button>
      </div>
    </div>
  );
}

/* ──────────────────── Program TM Table ──────────────────── */

function ProgramTmTable({
  items,
  exerciseMap,
  unitSystem,
  globalTmMap,
  onReload,
  programId,
}: {
  items: TrainingMax[];
  exerciseMap: Map<string, ExerciseTemplate>;
  unitSystem: string;
  globalTmMap: Map<string, GlobalTrainingMax>;
  onReload: () => Promise<void>;
  programId: string;
}) {
  if (items.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: 13,
        }}
      >
        No program overrides. Global TMs will be used. Click &quot;Override&quot;
        on the Global tab to create one.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: PROGRAM_GRID,
          gap: 8,
          padding: "6px 8px",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span>Exercise</span>
        <span>Program TM</span>
        <span>Global TM</span>
        <span />
      </div>

      {items.map((tm) => (
        <ProgramTmRow
          key={tm.id}
          tm={tm}
          exercise={exerciseMap.get(tm.exercise_template_id)}
          unitSystem={unitSystem}
          globalTm={globalTmMap.get(tm.exercise_template_id)}
          onReload={onReload}
          programId={programId}
        />
      ))}
    </div>
  );
}

function ProgramTmRow({
  tm,
  exercise,
  unitSystem,
  globalTm,
  onReload,
  programId,
}: {
  tm: TrainingMax;
  exercise: ExerciseTemplate | undefined;
  unitSystem: string;
  globalTm: GlobalTrainingMax | undefined;
  onReload: () => Promise<void>;
  programId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const unit = unitSystem as "metric" | "imperial";
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = async () => {
    const num = parseFloat(editValue);
    if (isNaN(num) || num <= 0) {
      setEditing(false);
      return;
    }
    const kg = parseWeightToKg(num, unit);
    try {
      await api.setTrainingMax(
        programId,
        tm.exercise_template_id,
        kg,
        undefined,
        "manual",
      );
      await onReload();
      toast.success("TM updated");
    } catch (e) {
      toast.error(`Failed: ${e}`);
    }
    setEditing(false);
  };

  const handleRemoveOverride = async () => {
    if (
      !confirm(
        `Remove program override for "${exercise?.title ?? "this exercise"}"? Global TM will be used instead.`,
      )
    )
      return;
    try {
      await api.deleteTrainingMax(programId, tm.exercise_template_id);
      await onReload();
      toast.success("Override removed");
    } catch (e) {
      toast.error(`Failed: ${e}`);
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: PROGRAM_GRID,
        gap: 8,
        padding: "6px 8px",
        alignItems: "center",
        fontSize: 13,
        borderBottom: "1px solid var(--border-subtle, rgba(255,255,255,0.05))",
      }}
    >
      <span title={exercise?.title}>
        {exercise?.title ?? tm.exercise_template_id}
      </span>

      {/* Program TM (editable) */}
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          step="any"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") setEditing(false);
          }}
          style={{
            width: "100%",
            fontSize: 13,
            padding: "2px 6px",
            background: "var(--bg-tertiary)",
            border: "1px solid var(--accent)",
            borderRadius: 4,
            color: "var(--text-primary)",
          }}
        />
      ) : (
        <span
          style={{ cursor: "pointer", fontWeight: 500 }}
          onClick={() => {
            setEditing(true);
            setEditValue(displayWeightRaw(tm.training_max_kg, unit));
          }}
          title="Click to edit"
        >
          {formatWeight(tm.training_max_kg, unit)}
        </span>
      )}

      {/* Global TM (read-only reference) */}
      <span style={{ color: "var(--text-muted)" }}>
        {globalTm ? formatWeight(globalTm.training_max_kg, unit) : "—"}
      </span>

      {/* Actions */}
      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleRemoveOverride}
          title="Remove override (revert to global TM)"
          style={{ fontSize: 11, padding: "2px 6px", color: "var(--error)" }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

/* ──────────────────── Add TM Row ──────────────────── */

function AddTrainingMaxRow({
  tab,
  programId,
  existingGlobalIds,
  existingProgramIds,
  unitSystem,
  onClose,
  onAdded,
}: {
  tab: "global" | "program";
  programId: string | null;
  existingGlobalIds: Set<string>;
  existingProgramIds: Set<string>;
  unitSystem: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { search } = useExerciseStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExerciseTemplate[]>([]);
  const [selected, setSelected] = useState<ExerciseTemplate | null>(null);
  const [tmValue, setTmValue] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tmInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const unit = unitSystem as "metric" | "imperial";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (query.trim()) {
      const r = search(query);
      const existingIds =
        tab === "global" ? existingGlobalIds : existingProgramIds;
      setResults(r.filter((t) => !existingIds.has(t.id)));
      setShowDropdown(true);
    } else {
      setResults([]);
      setShowDropdown(false);
    }
  }, [query, search, tab, existingGlobalIds, existingProgramIds]);

  const handleSelect = (exercise: ExerciseTemplate) => {
    setSelected(exercise);
    setQuery(exercise.title);
    setShowDropdown(false);
    setTimeout(() => tmInputRef.current?.focus(), 50);
  };

  const handleSave = async () => {
    if (!selected || !tmValue.trim()) return;
    const num = parseFloat(tmValue);
    if (isNaN(num) || num <= 0) return;
    const kg = parseWeightToKg(num, unit);

    try {
      if (tab === "global") {
        await api.setGlobalTrainingMax(selected.id, kg, undefined, "manual");
      } else if (programId) {
        await api.setTrainingMax(
          programId,
          selected.id,
          kg,
          undefined,
          "manual",
        );
      }
      onAdded();
    } catch (e) {
      toast.error(`Failed: ${e}`);
    }
  };

  return (
    <div
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
      }}
    >
      {/* Exercise search */}
      <div style={{ flex: 1, position: "relative" }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search exercise..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
          }}
          onFocus={() => {
            if (results.length > 0) setShowDropdown(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
          style={{ width: "100%", fontSize: 13, padding: "6px 10px" }}
        />
        {showDropdown && results.length > 0 && (
          <div
            ref={dropdownRef}
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              maxHeight: 200,
              overflow: "auto",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              zIndex: 100,
            }}
          >
            {results.map((ex) => (
              <button
                key={ex.id}
                onClick={() => handleSelect(ex)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "6px 10px",
                  border: "none",
                  background: "transparent",
                  color: "var(--text-primary)",
                  fontSize: 13,
                  textAlign: "left",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-tertiary)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {ex.title}
                {ex.equipment && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginLeft: 8,
                    }}
                  >
                    {EQUIPMENT_LABELS[ex.equipment] ?? ex.equipment}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* TM value */}
      <input
        ref={tmInputRef}
        type="number"
        step="any"
        min="0"
        placeholder={`TM (${unit === "imperial" ? "lbs" : "kg"})`}
        value={tmValue}
        onChange={(e) => setTmValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") onClose();
        }}
        style={{ width: 120, fontSize: 13, padding: "6px 10px" }}
      />

      <button
        className="btn btn-primary btn-sm"
        onClick={handleSave}
        disabled={!selected || !tmValue.trim()}
      >
        Save
      </button>
      <button className="btn btn-ghost btn-sm" onClick={onClose}>
        Cancel
      </button>
    </div>
  );
}

/* ──── Helpers ──── */

/** Get the raw number string for the edit input (no unit suffix) */
function displayWeightRaw(kg: number, unit: "metric" | "imperial"): string {
  if (unit === "imperial") {
    return String(Math.round(kg * 2.20462));
  }
  return String(Math.round(kg * 10) / 10);
}
