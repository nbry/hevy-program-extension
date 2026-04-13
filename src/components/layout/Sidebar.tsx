import { useNavigate, useLocation } from "react-router";
import { useProgramStore } from "../../stores/programStore";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { programs, programsLoaded, loadPrograms, createProgram } =
    useProgramStore();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!programsLoaded) {
      loadPrograms();
    }
  }, [programsLoaded, loadPrograms]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const id = await createProgram(newName.trim());
      setNewName("");
      setCreating(false);
      navigate(`/program/${id}`);
    } catch (e) {
      toast.error(`Failed to create program: ${e}`);
    }
  };

  return (
    <aside
      style={{
        width: 260,
        minWidth: 260,
        borderRight: "1px solid var(--border)",
        background: "var(--bg-secondary)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
        <h1
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "0.02em",
          }}
        >
          Hevy Program Extension
        </h1>
      </div>

      {/* Program List */}
      <div style={{ flex: 1, overflow: "auto", padding: "8px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 8px 4px",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Programs
          </span>
          <button
            className="btn-ghost btn-sm"
            onClick={() => setCreating(true)}
            style={{
              padding: "2px 6px",
              fontSize: 16,
              lineHeight: 1,
              borderRadius: 4,
            }}
          >
            +
          </button>
        </div>

        {creating && (
          <div style={{ padding: "4px 8px" }}>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") {
                  setCreating(false);
                  setNewName("");
                }
              }}
              onBlur={() => {
                if (!newName.trim()) {
                  setCreating(false);
                  setNewName("");
                }
              }}
              placeholder="Program name..."
              style={{ width: "100%", fontSize: 13, padding: "6px 8px" }}
            />
          </div>
        )}

        {programs.map((program) => {
          const isActive = location.pathname === `/program/${program.id}`;
          return (
            <button
              key={program.id}
              onClick={() => navigate(`/program/${program.id}`)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 12px",
                borderRadius: 6,
                border: "none",
                background: isActive ? "var(--bg-hover)" : "transparent",
                color: isActive
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.1s",
                marginBottom: 2,
              }}
              onMouseEnter={(e) => {
                if (!isActive)
                  e.currentTarget.style.background = "var(--bg-tertiary)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              {program.name}
            </button>
          );
        })}

        {programsLoaded && programs.length === 0 && !creating && (
          <div
            style={{
              padding: "20px 12px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 12,
            }}
          >
            No programs yet.
            <br />
            Click + to create one.
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "8px", borderTop: "1px solid var(--border)" }}>
        <button
          onClick={() => navigate("/settings")}
          className="btn-ghost"
          style={{
            width: "100%",
            justifyContent: "flex-start",
            padding: "8px 12px",
            fontSize: 13,
            borderRadius: 6,
            border: "none",
            background:
              location.pathname === "/settings"
                ? "var(--bg-hover)"
                : "transparent",
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          Settings
        </button>
      </div>
    </aside>
  );
}
