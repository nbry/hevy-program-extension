import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type CellValueChangedEvent,
  type GridReadyEvent,
  type GridApi,
} from "ag-grid-community";
import {
  type GridRow,
  exercisesToGridRows,
  gridRowsToExerciseInputs,
  formatSet,
  parseSetString,
  defaultSet,
  getMaxSets,
} from "./gridModel";
import type { Microcycle } from "../../types";
import { useExerciseStore } from "../../stores/exerciseStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useProgramStore } from "../../stores/programStore";
import { useAutoSave } from "../../hooks/useAutoSave";
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
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const templates = useExerciseStore((s) => s.templates);
  const markDirty = useProgramStore((s) => s.markDirty);

  // Load rows from microcycle data
  useEffect(() => {
    const gridRows = exercisesToGridRows(microcycle.exercises);
    setRows(gridRows);
    setSetColumnCount(Math.max(5, getMaxSets(gridRows)));
  }, [microcycle]);

  // Auto-save
  const save = useCallback(async () => {
    try {
      const inputs = gridRowsToExerciseInputs(rows);
      await api.saveMicrocycleExercises(microcycle.id, inputs);
      useProgramStore.getState().markClean();
    } catch (e) {
      toast.error(`Save failed: ${e}`);
    }
  }, [rows, microcycle.id]);

  const { trigger: triggerSave } = useAutoSave(save);

  // Build exercise name options for the dropdown
  const exerciseNames = useMemo(
    () => templates.map((t) => t.title).sort(),
    [templates],
  );

  const templatesByTitle = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of templates) map.set(t.title, t.id);
    return map;
  }, [templates]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    gridApiRef.current = params.api;
  }, []);

  const updateRow = useCallback(
    (rowIndex: number, updater: (row: GridRow) => GridRow) => {
      setRows((prev) => {
        const next = [...prev];
        if (next[rowIndex]) {
          next[rowIndex] = updater(next[rowIndex]);
        }
        return next;
      });
      markDirty();
      triggerSave();
    },
    [markDirty, triggerSave],
  );

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent) => {
      const { data, colDef } = event;
      const rowIdx = data.rowIndex as number;
      const field = colDef.field;

      if (!field) return;

      if (field === "exerciseTitle") {
        const newTitle = event.newValue as string;
        const templateId = templatesByTitle.get(newTitle);
        if (templateId) {
          updateRow(rowIdx, (r) => ({
            ...r,
            exerciseTitle: newTitle,
            exerciseTemplateId: templateId,
          }));
        }
      } else if (field === "restSeconds") {
        const val = parseInt(event.newValue);
        updateRow(rowIdx, (r) => ({
          ...r,
          restSeconds: isNaN(val) ? null : val,
        }));
      } else if (field === "notes") {
        updateRow(rowIdx, (r) => ({ ...r, notes: event.newValue || null }));
      } else if (field.startsWith("set_")) {
        const setIdx = parseInt(field.replace("set_", ""));
        const parsed = parseSetString(event.newValue || "", unitSystem);
        updateRow(rowIdx, (r) => {
          const newSets = [...r.sets];
          while (newSets.length <= setIdx) newSets.push(defaultSet());
          if (parsed) {
            newSets[setIdx] = parsed;
          } else {
            // Blank = remove this set (if it's the last one)
            newSets.splice(setIdx, 1);
          }
          return { ...r, sets: newSets };
        });
      }
    },
    [templatesByTitle, unitSystem, updateRow],
  );

  // Build column definitions
  const columnDefs = useMemo((): ColDef[] => {
    const cols: ColDef[] = [
      {
        headerName: "#",
        valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
        width: 50,
        editable: false,
        suppressMovable: true,
        cellStyle: { color: "var(--text-muted)", textAlign: "center" },
      },
      {
        field: "exerciseTitle",
        headerName: "Exercise",
        width: 240,
        editable: true,
        pinned: "left",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: exerciseNames },
        cellStyle: { fontWeight: 500 },
      },
    ];

    // Dynamic set columns
    for (let i = 0; i < setColumnCount; i++) {
      cols.push({
        field: `set_${i}`,
        headerName: `Set ${i + 1}`,
        width: 130,
        editable: true,
        valueGetter: (params) => {
          const row = params.data as GridRow;
          if (!row || !row.sets[i]) return "";
          return formatSet(row.sets[i], unitSystem);
        },
        valueSetter: (params) => {
          // Store the raw string; actual parsing happens in onCellValueChanged
          params.data[`set_${i}`] = params.newValue;
          return true;
        },
        cellStyle: (params) => {
          const row = params.data as GridRow;
          const s = row?.sets[i];
          if (!s) return { color: "var(--text-muted)" };
          if (s.setType === "warmup") return { color: "var(--warning)" };
          if (s.percentageOfTm != null) return { color: "var(--accent-hover)" };
          return null;
        },
      });
    }

    cols.push(
      {
        field: "restSeconds",
        headerName: "Rest",
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
  }, [exerciseNames, setColumnCount, unitSystem]);

  // Add exercise row
  const addRow = useCallback(() => {
    setRows((prev) => [
      ...prev,
      {
        rowIndex: prev.length,
        exerciseTemplateId: "",
        exerciseTitle: "",
        restSeconds: null,
        notes: null,
        sets: [defaultSet(), defaultSet(), defaultSet()],
      },
    ]);
    // Focus the new row's exercise cell after grid updates
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
    setRows((prev) =>
      prev
        .filter((r) => !selected.some((s) => s.rowIndex === r.rowIndex))
        .map((r, i) => ({ ...r, rowIndex: i })),
    );
    markDirty();
    triggerSave();
  }, [markDirty, triggerSave]);

  // Add set column
  const addSetColumn = useCallback(() => {
    setSetColumnCount((prev) => prev + 1);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
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
          rowSelection="single"
          getRowId={(params) => String(params.data.rowIndex)}
          singleClickEdit={true}
          stopEditingWhenCellsLoseFocus={true}
          domLayout="normal"
          suppressRowClickSelection={false}
          enableCellTextSelection={true}
          rowDragManaged={false}
        />
      </div>
    </div>
  );
}
