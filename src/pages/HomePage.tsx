import { useNavigate } from "react-router";
import { useProgramStore } from "../stores/programStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useExerciseStore } from "../stores/exerciseStore";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ImportModal } from "../components/sync/ImportModal";

export function HomePage() {
  const navigate = useNavigate();
  const { programs, programsLoaded, loadPrograms, createProgram } =
    useProgramStore();
  const { apiKeyConfigured, hevyUsername } = useSettingsStore();
  const { templates } = useExerciseStore();
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    if (!programsLoaded) loadPrograms();
  }, [programsLoaded, loadPrograms]);

  const handleCreateProgram = async () => {
    try {
      const id = await createProgram("New Program");
      navigate(`/program/${id}`);
    } catch (e) {
      toast.error(`Failed to create program: ${e}`);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          Welcome{hevyUsername ? `, ${hevyUsername}` : ""}
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          Design your training programs, then sync to Hevy.
        </p>
      </div>

      {/* Status bar */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "12px 16px",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Connection
          </div>
          <span
            className={`badge ${apiKeyConfigured ? "badge-success" : "badge-warning"}`}
          >
            {apiKeyConfigured ? "Connected" : "Not Connected"}
          </span>
        </div>
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "12px 16px",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Exercises
          </div>
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            {templates.length}
          </span>
          <span
            style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 4 }}
          >
            cached
          </span>
        </div>
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "12px 16px",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Programs
          </div>
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            {programs.length}
          </span>
        </div>
      </div>

      {/* Programs grid */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>Your Programs</h3>
        <div style={{ display: "flex", gap: 8 }}>
          {apiKeyConfigured && (
            <button
              className="btn btn-secondary"
              onClick={() => setShowImportModal(true)}
            >
              Import from Hevy
            </button>
          )}
          <button className="btn btn-primary" onClick={handleCreateProgram}>
            + New Program
          </button>
        </div>
      </div>

      {programs.length === 0 ? (
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
              marginBottom: 16,
            }}
          >
            You haven't created any programs yet.
          </p>
          <button className="btn btn-primary" onClick={handleCreateProgram}>
            Create Your First Program
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          {programs.map((program) => (
            <button
              key={program.id}
              onClick={() => navigate(`/program/${program.id}`)}
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 16,
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.15s",
                color: "var(--text-primary)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                {program.name}
              </div>
              {program.description && (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {program.description}
                </div>
              )}
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginTop: 8,
                }}
              >
                Updated {new Date(program.updated_at).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      )}

      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} />
      )}
    </div>
  );
}
