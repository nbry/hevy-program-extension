import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type CellValueChangedEvent,
  type GridReadyEvent,
  type GridApi,
  type ICellRendererParams,
} from "ag-grid-community";
import {
  type GridRow,
  type GridSet,
  exercisesToGridRows,
  gridRowsToExerciseInputs,
  formatSet,
  defaultSet,
  getMaxSets,
  nextRowId,
} from "./gridModel";
import { ExerciseNameEditor } from "./ExerciseNameEditor";
import { SetsCellEditor } from "./SetsCellEditor";
import type { Microcycle } from "../../types";
import { useExerciseStore } from "../../stores/exerciseStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useProgramStore } from "../../stores/programStore";
import * as api from "../../lib/tauri";
import { toast } from "sonner";

ModuleRegistry.registerModules([AllCommunityModule]);

interface Props {
  microcycle: Microcycle;
}

export function ProgramGrid({ microcycle }: Props) {
  const gridRef = useRef<AgGridReact>(null);
  const gridApiRef = useRef<GridApi | null>(null);
  const [rows, setRows] = useState<GridRow[]>([]);
  const [setColumnCount, setSetColumnCount] = useState(5);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const templates = useExerciseStore((s) => s.templates);
  const refreshActiveProgram = useProgramStore((s) => s.refreshActiveProgram);

  // Ref so save always reads current rows
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // Load rows only when switching to a DIFFERENT microcycle (by ID).
  const loadedMicrocycleIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (microcycle.id !== loadedMicrocycleIdRef.current) {
      loadedMicrocycleIdRef.current = microcycle.id;
      const gridRows = exercisesToGridRows(microcycle.exercises);
      setRows(gridRows);
      setSetColumnCount(Math.max(5, getMaxSets(gridRows)));
    }
  }, [microcycle]);

  // Save function — called by debounce timer or manual save button
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  const doSave = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaveStatus("saving");

    const currentRows = rowsRef.current;
    const inputs = gridRowsToExerciseInputs(currentRows);
    console.log("[ProgramGrid] Saving", inputs.length, "exercises for microcycle", microcycle.id);
    console.log("[ProgramGrid] Payload:", JSON.stringify(inputs, null, 2));

    if (inputs.length === 0) {
      console.log("[ProgramGrid] No valid exercises to save (all rows missing template ID)");
    }

    try {
      await api.saveMicrocycleExercises(microcycle.id, inputs);
      console.log("[ProgramGrid] Save successful");
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2000);

      // Refresh program store so navigating away and back shows saved data
      refreshActiveProgram().catch(() => {});
    } catch (e) {
      console.error("[ProgramGrid] Save failed:", e);
      setSaveStatus("error");
      toast.error(`Save failed: ${e}`);
    } finally {
      savingRef.current = false;
    }
  }, [microcycle.id, refreshActiveProgram]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave(), 500);
  }, [doSave]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Build exercise name options for the dropdown
  const templatesByTitle = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of templates) map.set(t.title, t.id);
    return map;
  }, [templates]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    gridApiRef.current = params.api;
  }, []);

  const updateRowById = useCallback(
    (rowId: string, updater: (row: GridRow) => GridRow) => {
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.id === rowId);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = updater(next[idx]);
        return next;
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  // Stable ref for set commit callback (used in columnDefs without triggering re-memo)
  const updateRowByIdRef = useRef(updateRowById);
  updateRowByIdRef.current = updateRowById;

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent) => {
      const { data, colDef } = event;
      const rowId = data.id as string;
      const field = colDef.field;

      if (!field) return;

      console.log("[ProgramGrid] onCellValueChanged:", field, "rowId:", rowId,
        "old:", event.oldValue, "new:", event.newValue);

      if (field === "exerciseTitle") {
        const newTitle = event.newValue as string;
        const templateId = templatesByTitle.get(newTitle);
        console.log("[ProgramGrid] Exercise selected:", newTitle, "templateId:", templateId);
        updateRowById(rowId, (r) => ({
          ...r,
          exerciseTitle: newTitle,
          exerciseTemplateId: templateId ?? r.exerciseTemplateId,
        }));
      } else if (field === "restSeconds") {
        const val = parseInt(event.newValue);
        updateRowById(rowId, (r) => ({
          ...r,
          restSeconds: isNaN(val) ? null : val,
        }));
      } else if (field === "notes") {
        updateRowById(rowId, (r) => ({ ...r, notes: event.newValue || null }));
      }
      // Note: set_* columns are handled via direct onCommit callback, not through
      // AG Grid's value pipeline (which is broken for popup/inline-overlay editors in v35).
    },
    [templatesByTitle, updateRowById],
  );

  // Build column definitions
  const columnDefs = useMemo((): ColDef[] => {
    const cols: ColDef[] = [
      {
        headerName: "#",
        valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
        width: 48,
        editable: false,
        suppressMovable: true,
        rowDrag: true,
        cellStyle: {
          color: "var(--text-muted)",
          textAlign: "center",
          cursor: "grab",
        },
      },
      {
        field: "exerciseTitle",
        headerName: "Exercise",
        width: 240,
        editable: true,
        pinned: "left",
        cellEditor: ExerciseNameEditor,
        cellStyle: { fontWeight: 500, overflow: "visible" },
      },
    ];

    // Dynamic set columns
    for (let i = 0; i < setColumnCount; i++) {
      cols.push({
        field: `set_${i}`,
        headerName: `Set ${i + 1}`,
        width: 150,
        editable: true,
        cellEditor: SetsCellEditor,
        cellEditorParams: {
          onCommit: (rowId: string, setIdx: number, gridSet: GridSet | null) => {
            updateRowByIdRef.current(rowId, (r) => {
              const newSets = [...r.sets];
              while (newSets.length <= setIdx) newSets.push(defaultSet());
              if (gridSet) {
                newSets[setIdx] = gridSet;
              } else {
                newSets.splice(setIdx, 1);
              }
              return { ...r, sets: newSets };
            });
          },
        },
        valueGetter: (params) => {
          const row = params.data as GridRow;
          if (!row || !row.sets[i]) return "";
          return formatSet(row.sets[i], unitSystem);
        },
        cellRenderer: (params: ICellRendererParams) => {
          const row = params.data as GridRow;
          const s = row?.sets[i];
          if (!s || (!s.reps && !s.repRangeStart && !s.weightKg && !s.percentageOfTm && !s.rpeTarget)) {
            return null;
          }

          // Calculate badge label
          let badgeLabel: string | null = null;
          let badgeColor: string | null = null;

          if (s.setType === "warmup") {
            badgeLabel = "W";
            badgeColor = "#f59e0b";
          } else if (s.setType === "failure") {
            badgeLabel = "F";
            badgeColor = "#ef4444";
          } else if (s.setType === "dropset") {
            badgeLabel = "D";
            badgeColor = "#a855f7";
          } else {
            // Normal: sequential number counting only normal sets up to this index
            let normalCount = 0;
            for (let j = 0; j <= i; j++) {
              const sj = row.sets[j];
              if (sj && (sj.reps || sj.repRangeStart || sj.weightKg || sj.percentageOfTm || sj.rpeTarget)) {
                if (sj.setType === "normal") normalCount++;
              }
            }
            badgeLabel = String(normalCount);
            badgeColor = "var(--accent)";
          }

          const textColor = s.percentageOfTm != null ? "var(--accent-hover)" : "var(--text-primary)";

          return (
            <div style={{ display: "flex", alignItems: "center", gap: 6, height: "100%" }}>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 18,
                height: 18,
                borderRadius: 3,
                fontSize: 10,
                fontWeight: 700,
                background: badgeColor,
                color: "#fff",
                flexShrink: 0,
                lineHeight: 1,
              }}>
                {badgeLabel}
              </span>
              <span style={{ color: textColor }}>{params.value}</span>
            </div>
          );
        },
      });
    }

    cols.push(
      {
        field: "restSeconds",
        headerName: "Rest (s)",
        width: 80,
        editable: true,
        valueFormatter: (p) => (p.value ? `${p.value}s` : ""),
      },
      {
        field: "notes",
        headerName: "Notes",
        width: 200,
        editable: true,
        cellStyle: { color: "var(--text-secondary)" },
      },
    );

    return cols;
  }, [setColumnCount, unitSystem]);

  // Add exercise row
  const addRow = useCallback(() => {
    setRows((prev) => [
      ...prev,
      {
        id: nextRowId(),
        rowIndex: prev.length,
        exerciseTemplateId: "",
        exerciseTitle: "",
        restSeconds: null,
        notes: null,
        sets: [defaultSet(), defaultSet(), defaultSet()],
      },
    ]);
    setTimeout(() => {
      if (gridApiRef.current) {
        const lastIdx = gridApiRef.current.getDisplayedRowCount() - 1;
        gridApiRef.current.ensureIndexVisible(lastIdx);
        gridApiRef.current.setFocusedCell(lastIdx, "exerciseTitle");
        gridApiRef.current.startEditingCell({
          rowIndex: lastIdx,
          colKey: "exerciseTitle",
        });
      }
    }, 50);
  }, []);

  // Remove selected row
  const removeSelectedRow = useCallback(() => {
    if (!gridApiRef.current) return;
    const selected = gridApiRef.current.getSelectedRows() as GridRow[];
    if (selected.length === 0) return;
    const selectedIds = new Set(selected.map((s) => s.id));
    setRows((prev) =>
      prev
        .filter((r) => !selectedIds.has(r.id))
        .map((r, i) => ({ ...r, rowIndex: i })),
    );
    scheduleSave();
  }, [scheduleSave]);

  // Add set column
  const addSetColumn = useCallback(() => {
    setSetColumnCount((prev) => prev + 1);
  }, []);

  // Handle row reorder via drag — read AG Grid's actual display order
  const onRowDragEnd = useCallback(
    () => {
      if (!gridApiRef.current) return;
      const newOrder: GridRow[] = [];
      gridApiRef.current.forEachNodeAfterFilterAndSort((node) => {
        newOrder.push(node.data as GridRow);
      });
      setRows(newOrder.map((r, i) => ({ ...r, rowIndex: i })));
      scheduleSave();
    },
    [scheduleSave],
  );

  // Manual save handler
  const handleManualSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    doSave();
  }, [doSave]);

  const saveStatusText =
    saveStatus === "saving" ? "Saving..." :
    saveStatus === "saved" ? "Saved" :
    saveStatus === "error" ? "Error!" :
    "";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Warning: no exercise templates */}
      {templates.length === 0 && (
        <div
          style={{
            padding: "8px 12px",
            background: "rgba(250, 204, 21, 0.1)",
            border: "1px solid rgba(250, 204, 21, 0.3)",
            borderRadius: 6,
            fontSize: 12,
            color: "var(--warning, #facc15)",
            marginBottom: 4,
          }}
        >
          No exercise templates loaded. Go to <strong>Settings</strong> and click{" "}
          <strong>"Sync Exercise Templates"</strong> to fetch exercises from Hevy.
          Exercises cannot be saved without a valid template.
        </div>
      )}

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "8px 0",
          alignItems: "center",
        }}
      >
        <button className="btn btn-secondary btn-sm" onClick={addRow}>
          + Exercise
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={removeSelectedRow}
        >
          Remove
        </button>
        <button className="btn btn-secondary btn-sm" onClick={addSetColumn}>
          + Set Column
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleManualSave}
          style={{ fontWeight: 600 }}
        >
          Save
        </button>
        {saveStatusText && (
          <span style={{
            fontSize: 11,
            color: saveStatus === "error" ? "var(--error)" :
                   saveStatus === "saved" ? "#4ade80" :
                   "var(--text-muted)",
            fontWeight: 500,
          }}>
            {saveStatusText}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {rows.length} exercise{rows.length !== 1 ? "s" : ""} &middot; Enter
          sets as: 5x85% or 8-12x70kg or 10 @8
        </span>
      </div>

      {/* Grid */}
      <div className="ag-theme-alpine-dark" style={{ flex: 1, width: "100%" }}>
        <AgGridReact
          ref={gridRef}
          rowData={rows}
          columnDefs={columnDefs}
          onGridReady={onGridReady}
          onCellValueChanged={onCellValueChanged}
          onRowDragEnd={onRowDragEnd}
          rowSelection="single"
          getRowId={(params) => params.data.id}
          singleClickEdit={true}
          stopEditingWhenCellsLoseFocus={true}
          domLayout="normal"
          suppressRowClickSelection={false}
          enableCellTextSelection={true}
          rowDragManaged={true}
          animateRows={true}
        />
      </div>
    </div>
  );
}
