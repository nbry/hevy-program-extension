import { useParams, useNavigate } from "react-router";
import { useProgramStore } from "../stores/programStore";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProgramGrid } from "../components/grid/ProgramGrid";
import { SyncModal } from "../components/sync/SyncModal";
import { PullModal } from "../components/sync/PullModal";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useContextMenu } from "../hooks/useContextMenu";
import {
  ContextMenu,
  type ContextMenuItem,
} from "../components/ui/ContextMenu";

export function ProgramPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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
    renameProgram,
    getActiveBlock,
    getActiveMesocycle,
    getActiveMicrocycle,
    moveMicrocycle,
    setMesocycleMirror,
    syncStatus,
    loadSyncStatus,
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
      renameProgram: s.renameProgram,
      getActiveBlock: s.getActiveBlock,
      getActiveMesocycle: s.getActiveMesocycle,
      getActiveMicrocycle: s.getActiveMicrocycle,
      moveMicrocycle: s.moveMicrocycle,
      setMesocycleMirror: s.setMesocycleMirror,
      syncStatus: s.syncStatus,
      loadSyncStatus: s.loadSyncStatus,
    })),
  );

  useEffect(() => {
    if (id && id !== activeProgram?.id) {
      loadProgram(id);
    }
  }, [id, activeProgram?.id, loadProgram]);

  // Program name rename state (must be before early return)
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showPullModal, setShowPullModal] = useState(false);

  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingName]);

  const commitRename = useCallback(() => {
    const trimmed = nameValue.trim();
    if (trimmed && activeProgram && trimmed !== activeProgram.name) {
      renameProgram(activeProgram.id, trimmed).catch((e) =>
        toast.error(`${e}`),
      );
    }
    setEditingName(false);
  }, [nameValue, activeProgram, renameProgram]);

  // Tab context menus (must be before early return)
  const {
    menu: tabMenu,
    open: openTabMenu,
    close: closeTabMenu,
  } = useContextMenu();

  const block = getActiveBlock();
  const mesocycle = getActiveMesocycle();
  const microcycle = getActiveMicrocycle();

  const getTabMenuItems = useCallback((): ContextMenuItem[] => {
    const data = tabMenu.data as { level: string; index: number } | undefined;
    if (!data || !activeProgram) return [];
    const items: ContextMenuItem[] = [];
    const { level, index } = data;

    if (level === "block") {
      const b = activeProgram.blocks[index];
      if (!b) return [];
      items.push({
        label: "Rename",
        onClick: () => {
          setActiveBlock(index);
          // Trigger double-click rename programmatically isn't easy,
          // so we'll use the existing TabBar double-click mechanism
          // For simplicity: just select the tab (user can double-click)
        },
      });
      if (activeProgram.blocks.length > 1) {
        if (index > 0)
          items.push({
            label: "Move Left",
            onClick: () => {
              const ids = activeProgram.blocks.map((bl) => bl.id);
              [ids[index], ids[index - 1]] = [ids[index - 1], ids[index]];
              reorderBlocks(ids)
                .then(() => setActiveBlock(index - 1))
                .catch((e) => toast.error(`${e}`));
            },
          });
        if (index < activeProgram.blocks.length - 1)
          items.push({
            label: "Move Right",
            onClick: () => {
              const ids = activeProgram.blocks.map((bl) => bl.id);
              [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
              reorderBlocks(ids)
                .then(() => setActiveBlock(index + 1))
                .catch((e) => toast.error(`${e}`));
            },
          });
      }
      items.push({ label: "", onClick: () => {}, separator: true });
      items.push({
        label: "Delete",
        danger: true,
        onClick: () => {
          if (confirm(`Delete "${b.name}"?`)) {
            deleteBlock(b.id).catch((e) => toast.error(`${e}`));
          }
        },
      });
    } else if (level === "mesocycle") {
      const mesos = block?.mesocycles ?? [];
      const m = mesos[index];
      if (!m) return [];
      items.push({
        label: "Rename",
        onClick: () => setActiveMesocycle(index),
      });
      if (!m.mirror_of) {
        items.push({
          label: "Duplicate",
          onClick: () =>
            duplicateMesocycle(m.id).catch((e) => toast.error(`${e}`)),
        });
      }
      if (mesos.length > 1) {
        if (index > 0)
          items.push({
            label: "Move Left",
            onClick: () => {
              const ids = mesos.map((ms) => ms.id);
              [ids[index], ids[index - 1]] = [ids[index - 1], ids[index]];
              reorderMesocycles(ids)
                .then(() => setActiveMesocycle(index - 1))
                .catch((e) => toast.error(`${e}`));
            },
          });
        if (index < mesos.length - 1)
          items.push({
            label: "Move Right",
            onClick: () => {
              const ids = mesos.map((ms) => ms.id);
              [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
              reorderMesocycles(ids)
                .then(() => setActiveMesocycle(index + 1))
                .catch((e) => toast.error(`${e}`));
            },
          });
      }
      // Mirror options
      if (m.mirror_of) {
        items.push({
          label: "Remove Mirror",
          onClick: () => {
            setMesocycleMirror(m.id, null).catch((e) => toast.error(`${e}`));
          },
        });
      } else {
        // Build "Mirror of..." submenu with eligible non-mirror mesocycles
        const mirrorSubmenu: ContextMenuItem[] = [];
        for (const b of activeProgram.blocks) {
          const eligible = b.mesocycles.filter(
            (ms) => ms.id !== m.id && !ms.mirror_of,
          );
          if (eligible.length === 0) continue;
          mirrorSubmenu.push({ label: b.name, isGroupHeader: true });
          for (const ms of eligible) {
            mirrorSubmenu.push({
              label: ms.name,
              onClick: () => {
                if (
                  confirm(
                    `Make "${m.name}" a mirror of "${ms.name}"? Its current days will be deleted.`,
                  )
                ) {
                  setMesocycleMirror(m.id, ms.id).catch((e) =>
                    toast.error(`${e}`),
                  );
                }
              },
            });
          }
        }
        if (mirrorSubmenu.length > 0) {
          items.push({ label: "Mirror of...", submenu: mirrorSubmenu });
        }
      }
      items.push({ label: "", separator: true });
      items.push({
        label: "Delete",
        danger: true,
        onClick: () => {
          if (confirm(`Delete "${m.name}"?`)) {
            deleteMesocycle(m.id).catch((e) => toast.error(`${e}`));
          }
        },
      });
    } else if (level === "microcycle") {
      const micros = mesocycle?.microcycles ?? [];
      const mc = micros[index];
      if (!mc) return [];
      items.push({
        label: "Rename",
        onClick: () => setActiveMicrocycle(mc.id),
      });
      // Build "Move to..." submenu with all mesocycles grouped by block
      const moveSubmenu: ContextMenuItem[] = [];
      for (const b of activeProgram.blocks) {
        moveSubmenu.push({ label: b.name, isGroupHeader: true });
        for (const ms of b.mesocycles) {
          const isCurrent = ms.id === mesocycle?.id;
          moveSubmenu.push({
            label: ms.name + (ms.mirror_of ? " (mirror)" : ""),
            disabled: isCurrent || !!ms.mirror_of,
            onClick: () => {
              moveMicrocycle(mc.id, ms.id).catch((e) => toast.error(`${e}`));
            },
          });
        }
      }
      if (moveSubmenu.length > 0) {
        items.push({ label: "Move to...", submenu: moveSubmenu });
      }
      items.push({ label: "", separator: true });
      items.push({
        label: "Delete",
        danger: true,
        onClick: () => {
          if (confirm(`Delete "${mc.name}"?`)) {
            deleteMicrocycle(mc.id).catch((e) => toast.error(`${e}`));
          }
        },
      });
    }

    return items;
  }, [
    tabMenu.data,
    activeProgram,
    block,
    mesocycle,
    setActiveBlock,
    setActiveMesocycle,
    setActiveMicrocycle,
    reorderBlocks,
    reorderMesocycles,
    deleteBlock,
    deleteMesocycle,
    deleteMicrocycle,
    duplicateMesocycle,
    moveMicrocycle,
    setMesocycleMirror,
  ]);

  if (!activeProgram) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        <span style={{ color: "var(--text-secondary)" }}>
          Loading program...
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: 0,
      }}
    >
      {/* Program header */}
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div>
          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditingName(false);
              }}
              style={{
                fontSize: 18,
                fontWeight: 600,
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                border: "1px solid var(--accent)",
                borderRadius: 4,
                padding: "2px 8px",
                outline: "none",
                width: Math.max(200, nameValue.length * 10 + 40),
              }}
            />
          ) : (
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                marginBottom: 2,
                cursor: "pointer",
              }}
              onDoubleClick={() => {
                setEditingName(true);
                setNameValue(activeProgram.name);
              }}
              title="Double-click to rename"
            >
              {activeProgram.name}
            </h2>
          )}
          {activeProgram.description && (
            <p style={{ color: "var(--text-secondary)", fontSize: 12 }}>
              {activeProgram.description}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() =>
              navigate(`/training-maxes?programId=${activeProgram.id}`)
            }
            style={{ fontSize: 12, whiteSpace: "nowrap" }}
          >
            Training Maxes
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowSyncModal(true)}
            style={{ fontSize: 12, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}
          >
            Push to Hevy
            {syncStatus && syncStatus.sync_status === "synced" && (
              <span className="badge badge-success" style={{ fontSize: 9, padding: "1px 5px" }}>
                Synced
              </span>
            )}
            {syncStatus && syncStatus.sync_status === "error" && (
              <span className="badge badge-error" style={{ fontSize: 9, padding: "1px 5px" }}>
                Error
              </span>
            )}
          </button>
          {syncStatus && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowPullModal(true)}
              style={{ fontSize: 12, whiteSpace: "nowrap" }}
            >
              Pull from Hevy
            </button>
          )}
        </div>
      </div>

      {/* Block tabs */}
      <TabBar
        label="Blocks"
        items={activeProgram.blocks.map((b) => b.name)}
        activeIndex={activeBlockIndex}
        onSelect={setActiveBlock}
        onRename={
          block
            ? (name) => {
                renameBlock(block.id, name).catch((e) => toast.error(`${e}`));
              }
            : undefined
        }
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
        onTabContextMenu={(i, e) =>
          openTabMenu(e, { level: "block", index: i })
        }
      />

      {/* Mesocycle (week) tabs */}
      {block && (
        <TabBar
          label="Weeks"
          items={block.mesocycles.map((m) =>
            m.mirror_of ? `${m.name} (mirror)` : m.name,
          )}
          activeIndex={activeMesocycleIndex}
          onSelect={setActiveMesocycle}
          onRename={
            mesocycle
              ? (name) => {
                  renameMesocycle(mesocycle.id, name).catch((e) =>
                    toast.error(`${e}`),
                  );
                }
              : undefined
          }
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
                    deleteMesocycle(mesocycle.id).catch((e) =>
                      toast.error(`${e}`),
                    );
                  }
                }
              : undefined
          }
          onDuplicate={
            mesocycle
              ? () => {
                  duplicateMesocycle(mesocycle.id).catch((e) =>
                    toast.error(`${e}`),
                  );
                }
              : undefined
          }
          onTabContextMenu={(i, e) =>
            openTabMenu(e, { level: "mesocycle", index: i })
          }
        />
      )}

      {/* Microcycle (day) tabs */}
      {mesocycle && (
        <TabBar
          label={mesocycle.mirror_of ? "Days (read-only mirror)" : "Days"}
          items={mesocycle.microcycles.map((m) => m.name)}
          activeIndex={mesocycle.microcycles.findIndex(
            (m) => m.id === activeMicrocycleId,
          )}
          onSelect={(idx) =>
            setActiveMicrocycle(mesocycle.microcycles[idx]?.id ?? null)
          }
          onRename={
            !mesocycle.mirror_of && microcycle
              ? (name) => {
                  renameMicrocycle(microcycle.id, name).catch((e) =>
                    toast.error(`${e}`),
                  );
                }
              : undefined
          }
          onReorder={
            !mesocycle.mirror_of
              ? (fromIdx, toIdx) => {
                  const ids = mesocycle.microcycles.map((m) => m.id);
                  const [moved] = ids.splice(fromIdx, 1);
                  ids.splice(toIdx, 0, moved);
                  reorderMicrocycles(ids)
                    .then(() => setActiveMicrocycle(ids[toIdx]))
                    .catch((e) => toast.error(`${e}`));
                }
              : undefined
          }
          onAdd={
            !mesocycle.mirror_of
              ? () => {
                  const dayNum = mesocycle.microcycles.length + 1;
                  addMicrocycle(
                    mesocycle.id,
                    `Day ${dayNum}`,
                    dayNum,
                  ).catch((e) => toast.error(`${e}`));
                }
              : undefined
          }
          onDelete={
            !mesocycle.mirror_of &&
            mesocycle.microcycles.length > 0 &&
            microcycle
              ? () => {
                  if (confirm(`Delete "${microcycle.name}"?`)) {
                    deleteMicrocycle(microcycle.id).catch((e) =>
                      toast.error(`${e}`),
                    );
                  }
                }
              : undefined
          }
          onTabContextMenu={
            !mesocycle.mirror_of
              ? (i, e) => openTabMenu(e, { level: "microcycle", index: i })
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

      {tabMenu.visible && (
        <ContextMenu
          x={tabMenu.x}
          y={tabMenu.y}
          items={getTabMenuItems()}
          onClose={closeTabMenu}
        />
      )}

      {showSyncModal && (
        <SyncModal
          programId={activeProgram.id}
          onClose={() => setShowSyncModal(false)}
          onSyncComplete={() => {
            if (activeProgram) {
              loadSyncStatus(activeProgram.id);
            }
          }}
        />
      )}

      {showPullModal && (
        <PullModal
          programId={activeProgram.id}
          onClose={() => setShowPullModal(false)}
          onPullComplete={() => {
            if (activeProgram) {
              loadProgram(activeProgram.id);
              loadSyncStatus(activeProgram.id);
            }
          }}
        />
      )}
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
  onTabContextMenu,
}: {
  label: string;
  items: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onRename?: (newName: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onTabContextMenu?: (index: number, event: React.MouseEvent) => void;
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
        {items.map((name, i) =>
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
              onContextMenu={(e) => onTabContextMenu?.(i, e)}
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
          ),
        )}
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
                if (activeIndex < items.length - 1)
                  onReorder(activeIndex, activeIndex + 1);
              }}
              disabled={activeIndex >= items.length - 1}
            />
          </>
        )}
        {onAdd && (
          <TabBarButton
            label="+"
            title={`Add ${label.toLowerCase().slice(0, -1)}`}
            onClick={onAdd}
          />
        )}
        {onDuplicate && (
          <TabBarButton
            label="&#x2398;"
            title="Duplicate"
            onClick={onDuplicate}
          />
        )}
        {onDelete && (
          <TabBarButton
            label="&times;"
            title="Delete"
            onClick={onDelete}
            danger
          />
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
  let message =
    'Add a training block to get started. Click the "+" next to Blocks.';
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
