import { useParams } from "react-router";
import { useProgramStore } from "../stores/programStore";
import { useEffect } from "react";

export function ProgramPage() {
  const { id } = useParams<{ id: string }>();
  const { activeProgram, loadProgram } = useProgramStore();

  useEffect(() => {
    if (id && id !== activeProgram?.id) {
      loadProgram(id);
    }
  }, [id, activeProgram?.id, loadProgram]);

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
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
          {activeProgram.name}
        </h2>
        {activeProgram.description && (
          <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            {activeProgram.description}
          </p>
        )}
      </div>

      {/* Block tabs */}
      {activeProgram.blocks.length === 0 ? (
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: 14,
              marginBottom: 8,
            }}
          >
            This program is empty.
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: 12 }}>
            Program builder with blocks, weeks, and days will be available in
            Phase 2.
          </p>
        </div>
      ) : (
        <div>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            {activeProgram.blocks.length} block(s) loaded. Grid editor coming in
            Phase 2.
          </p>
        </div>
      )}
    </div>
  );
}
