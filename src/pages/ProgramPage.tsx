import { useParams } from "react-router";
import { useProgramStore } from "../stores/programStore";
import { useEffect } from "react";
import { ProgramGrid } from "../components/grid/ProgramGrid";
import { toast } from "sonner";

export function ProgramPage() {
  const { id } = useParams<{ id: string }>();
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
    deleteBlock,
    deleteMesocycle,
    deleteMicrocycle,
    duplicateMesocycle,
    getActiveBlock,
    getActiveMesocycle,
    getActiveMicrocycle,
  } = useProgramStore();

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

/** Reusable horizontal tab bar */
function TabBar({
  label,
  items,
  activeIndex,
  onSelect,
  onAdd,
  onDelete,
  onDuplicate,
}: {
  label: string;
  items: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}) {
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
          <button
            key={i}
            onClick={() => onSelect(i)}
            style={{
              padding: "4px 12px",
              borderRadius: 4,
              border: "none",
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
        ))}
      </div>

      <div style={{ display: "flex", gap: 2, marginLeft: 4 }}>
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
}: {
  label: string;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 24,
        height: 24,
        borderRadius: 4,
        border: "none",
        background: "transparent",
        color: danger ? "var(--error)" : "var(--text-muted)",
        fontSize: 14,
        lineHeight: 1,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-tertiary)";
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
