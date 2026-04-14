import { useParams } from "react-router";
import { useProgramStore } from "../stores/programStore";
import { useEffect, useRef, useState } from "react";
import { ProgramGrid } from "../components/grid/ProgramGrid";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

export function ProgramPage() {
  const { id } = useParams<{ id: string }>();

  // Use shallow selector to avoid re-renders from unrelated store changes (isDirty, etc.)
  const {
    activeProgram,
    loadProgram,
    activeBlockIndex,
    activeMesocycleIndex,
    activeMicrocycleId,
    setActiveBlock,
    setActiveMesocycle,
    setActiveMicrocycle,
    addBlock,
    addMesocycle,
    addMicrocycle,
    renameBlock,
    renameMesocycle,
    renameMicrocycle,
    reorderBlocks,
    reorderMesocycles,
    reorderMicrocycles,
    deleteBlock,
    deleteMesocycle,
    deleteMicrocycle,
    duplicateMesocycle,
    getActiveBlock,
    getActiveMesocycle,
    getActiveMicrocycle,
  } = useProgramStore(
    useShallow((s) => ({
      activeProgram: s.activeProgram,
      loadProgram: s.loadProgram,
      activeBlockIndex: s.activeBlockIndex,
      activeMesocycleIndex: s.activeMesocycleIndex,
      activeMicrocycleId: s.activeMicrocycleId,
      setActiveBlock: s.setActiveBlock,
      setActiveMesocycle: s.setActiveMesocycle,
      setActiveMicrocycle: s.setActiveMicrocycle,
      addBlock: s.addBlock,
      addMesocycle: s.addMesocycle,
      addMicrocycle: s.addMicrocycle,
      renameBlock: s.renameBlock,
      renameMesocycle: s.renameMesocycle,
      renameMicrocycle: s.renameMicrocycle,
      reorderBlocks: s.reorderBlocks,
      reorderMesocycles: s.reorderMesocycles,
      reorderMicrocycles: s.reorderMicrocycles,
      deleteBlock: s.deleteBlock,
      deleteMesocycle: s.deleteMesocycle,
      deleteMicrocycle: s.deleteMicrocycle,
      duplicateMesocycle: s.duplicateMesocycle,
      getActiveBlock: s.getActiveBlock,
      getActiveMesocycle: s.getActiveMesocycle,
      getActiveMicrocycle: s.getActiveMicrocycle,
    })),
  );

  useEffect(() => {
    if (id && id !== activeProgram?.id) {
      loadProgram(id);
    }
  }, [id, activeProgram?.id, loadProgram]);

  if (!activeProgram) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <span style={{ color: "var(--text-secondary)" }}>Loading program...</span>
      </div>
    );
  }

  const block = getActiveBlock();
  const mesocycle = getActiveMesocycle();
  const microcycle = getActiveMicrocycle();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>
      {/* Program header */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>
          {activeProgram.name}
        </h2>
        {activeProgram.description && (
          <p style={{ color: "var(--text-secondary)", fontSize: 12 }}>
            {activeProgram.description}
          </p>
        )}
      </div>

      {/* Block tabs */}
      <TabBar
        label="Blocks"
        items={activeProgram.blocks.map((b) => b.name)}
        activeIndex={activeBlockIndex}
        onSelect={setActiveBlock}
        onRename={block ? (name) => {
          renameBlock(block.id, name).catch((e) => toast.error(`${e}`));
        } : undefined}
        onReorder={(fromIdx, toIdx) => {
          const ids = activeProgram.blocks.map((b) => b.id);
          const [moved] = ids.splice(fromIdx, 1);
          ids.splice(toIdx, 0, moved);
          reorderBlocks(ids)
            .then(() => setActiveBlock(toIdx))
            .catch((e) => toast.error(`${e}`));
        }}
        onAdd={() => {
          const name = `Block ${activeProgram.blocks.length + 1}`;
          addBlock(name).catch((e) => toast.error(`${e}`));
        }}
        onDelete={
          activeProgram.blocks.length > 0 && block
            ? () => {
                if (confirm(`Delete "${block.name}" and all its contents?`)) {
                  deleteBlock(block.id).catch((e) => toast.error(`${e}`));
                }
              }
            : undefined
        }
      />

      {/* Mesocycle (week) tabs */}
      {block && (
        <TabBar
          label="Weeks"
          items={block.mesocycles.map((m) => m.name)}
          activeIndex={activeMesocycleIndex}
          onSelect={setActiveMesocycle}
          onRename={mesocycle ? (name) => {
            renameMesocycle(mesocycle.id, name).catch((e) => toast.error(`${e}`));
          } : undefined}
          onReorder={(fromIdx, toIdx) => {
            const ids = block.mesocycles.map((m) => m.id);
            const [moved] = ids.splice(fromIdx, 1);
            ids.splice(toIdx, 0, moved);
            reorderMesocycles(ids)
              .then(() => setActiveMesocycle(toIdx))
              .catch((e) => toast.error(`${e}`));
          }}
          onAdd={() => {
            const weekNum = block.mesocycles.length + 1;
            addMesocycle(block.id, `Week ${weekNum}`, weekNum).catch((e) =>
              toast.error(`${e}`),
            );
          }}
          onDelete={
            block.mesocycles.length > 0 && mesocycle
              ? () => {
                  if (confirm(`Delete "${mesocycle.name}" and all its days?`)) {
                    deleteMesocycle(mesocycle.id).catch((e) => toast.error(`${e}`));
                  }
                }
              : undefined
          }
          onDuplicate={
            mesocycle
              ? () => {
                  duplicateMesocycle(mesocycle.id).catch((e) => toast.error(`${e}`));
                }
              : undefined
          }
        />
      )}

      {/* Microcycle (day) tabs */}
      {mesocycle && (
        <TabBar
          label="Days"
          items={mesocycle.microcycles.map((m) => m.name)}
          activeIndex={mesocycle.microcycles.findIndex((m) => m.id === activeMicrocycleId)}
          onSelect={(idx) => setActiveMicrocycle(mesocycle.microcycles[idx]?.id ?? null)}
          onRename={microcycle ? (name) => {
            renameMicrocycle(microcycle.id, name).catch((e) => toast.error(`${e}`));
          } : undefined}
          onReorder={(fromIdx, toIdx) => {
            const ids = mesocycle.microcycles.map((m) => m.id);
            const [moved] = ids.splice(fromIdx, 1);
            ids.splice(toIdx, 0, moved);
            reorderMicrocycles(ids)
              .then(() => setActiveMicrocycle(ids[toIdx]))
              .catch((e) => toast.error(`${e}`));
          }}
          onAdd={() => {
            const dayNum = mesocycle.microcycles.length + 1;
            addMicrocycle(mesocycle.id, `Day ${dayNum}`, dayNum).catch((e) =>
              toast.error(`${e}`),
            );
          }}
          onDelete={
            mesocycle.microcycles.length > 0 && microcycle
              ? () => {
                  if (confirm(`Delete "${microcycle.name}"?`)) {
                    deleteMicrocycle(microcycle.id).catch((e) => toast.error(`${e}`));
                  }
                }
              : undefined
          }
        />
      )}

      {/* Grid or empty state */}
      <div style={{ flex: 1, minHeight: 0, marginTop: 8 }}>
        {microcycle ? (
          <ProgramGrid microcycle={microcycle} />
        ) : (
          <EmptyState
            hasBlocks={activeProgram.blocks.length > 0}
            hasMesocycles={(block?.mesocycles.length ?? 0) > 0}
            hasMicrocycles={(mesocycle?.microcycles?.length ?? 0) > 0}
          />
        )}
      </div>
    </div>
  );
}

/** Reusable horizontal tab bar with double-click to rename and arrow buttons to reorder */
function TabBar({
  label,
  items,
  activeIndex,
  onSelect,
  onAdd,
  onDelete,
  onDuplicate,
  onRename,
  onReorder,
}: {
  label: string;
  items: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onRename?: (newName: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingIndex !== null) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingIndex]);

  const commitRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== items[editingIndex!] && onRename) {
      onRename(trimmed);
    }
    setEditingIndex(null);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 0",
        borderBottom: "1px solid var(--border)",
        minHeight: 36,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginRight: 8,
          userSelect: "none",
          minWidth: 42,
        }}
      >
        {label}
      </span>

      <div style={{ display: "flex", gap: 2, overflow: "auto", flex: 1 }}>
        {items.map((name, i) => (
          editingIndex === i ? (
            <input
              key={i}
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setEditingIndex(null);
              }}
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                border: "1px solid var(--accent)",
                fontSize: 12,
                fontWeight: 600,
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                outline: "none",
                width: Math.max(60, editValue.length * 8 + 20),
              }}
            />
          ) : (
            <button
              key={i}
              onClick={() => onSelect(i)}
              onDoubleClick={() => {
                if (i === activeIndex && onRename) {
                  setEditingIndex(i);
                  setEditValue(name);
                }
              }}
              style={{
                padding: "4px 12px",
                borderRadius: 4,
                border: "1px solid transparent",
                fontSize: 12,
                fontWeight: i === activeIndex ? 600 : 400,
                background: i === activeIndex ? "var(--accent)" : "transparent",
                color: i === activeIndex ? "#fff" : "var(--text-secondary)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.1s",
              }}
              onMouseEnter={(e) => {
                if (i !== activeIndex)
                  e.currentTarget.style.background = "var(--bg-tertiary)";
              }}
              onMouseLeave={(e) => {
                if (i !== activeIndex)
                  e.currentTarget.style.background = "transparent";
              }}
            >
              {name}
            </button>
          )
        ))}
      </div>

      <div style={{ display: "flex", gap: 2, marginLeft: 4 }}>
        {/* Move left/right buttons for reordering active tab */}
        {onReorder && items.length > 1 && (
          <>
            <TabBarButton
              label="&#x25C0;"
              title="Move left"
              onClick={() => {
                if (activeIndex > 0) onReorder(activeIndex, activeIndex - 1);
              }}
              disabled={activeIndex <= 0}
            />
            <TabBarButton
              label="&#x25B6;"
              title="Move right"
              onClick={() => {
                if (activeIndex < items.length - 1) onReorder(activeIndex, activeIndex + 1);
              }}
              disabled={activeIndex >= items.length - 1}
            />
          </>
        )}
        <TabBarButton label="+" title={`Add ${label.toLowerCase().slice(0, -1)}`} onClick={onAdd} />
        {onDuplicate && (
          <TabBarButton label="&#x2398;" title="Duplicate" onClick={onDuplicate} />
        )}
        {onDelete && (
          <TabBarButton label="&times;" title="Delete" onClick={onDelete} danger />
        )}
      </div>
    </div>
  );
}

function TabBarButton({
  label,
  title,
  onClick,
  danger,
  disabled,
}: {
  label: string;
  title: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 24,
        height: 24,
        borderRadius: 4,
        border: "none",
        background: "transparent",
        color: danger ? "var(--error)" : "var(--text-muted)",
        fontSize: 14,
        lineHeight: 1,
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.3 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = "var(--bg-tertiary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
      dangerouslySetInnerHTML={{ __html: label }}
    />
  );
}

function EmptyState({
  hasBlocks,
  hasMesocycles,
}: {
  hasBlocks: boolean;
  hasMesocycles: boolean;
  hasMicrocycles?: boolean;
}) {
  let message = 'Add a training block to get started. Click the "+" next to Blocks.';
  if (hasBlocks && !hasMesocycles) {
    message = 'Add a week to this block. Click the "+" next to Weeks.';
  } else if (hasMesocycles) {
    message = 'Add a training day to this week. Click the "+" next to Days.';
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{message}</p>
    </div>
  );
}
