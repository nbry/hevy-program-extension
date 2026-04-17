import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import * as api from "../../lib/tauri";
import type {
  HevyFolderInfo,
  ImportPreview,
  ImportResult,
} from "../../lib/tauri";
import { useProgramStore } from "../../stores/programStore";

interface ImportModalProps {
  onClose: () => void;
}

type ModalState =
  | "loading"
  | "folder-select"
  | "preview-loading"
  | "preview"
  | "importing"
  | "complete"
  | "error";

export function ImportModal({ onClose }: ImportModalProps) {
  const navigate = useNavigate();
  const { programs, loadPrograms } = useProgramStore();

  const [state, setState] = useState<ModalState>("loading");
  const [folders, setFolders] = useState<HevyFolderInfo[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [programName, setProgramName] = useState("");
  const [targetMode, setTargetMode] = useState<"new_program" | "new_block">(
    "new_program",
  );
  const [targetProgramId, setTargetProgramId] = useState<string | null>(null);

  // Load folders on mount
  useEffect(() => {
    api
      .listHevyFolders()
      .then((f) => {
        setFolders(f);
        setState("folder-select");
      })
      .catch((e) => {
        setError(`${e}`);
        setState("error");
      });
  }, []);

  const handleSelectFolder = async () => {
    if (selectedFolderId === null) return;
    setState("preview-loading");
    try {
      const p = await api.previewImport(selectedFolderId);
      setPreview(p);
      setProgramName(p.folder_name);
      setState("preview");
    } catch (e) {
      setError(`${e}`);
      setState("error");
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    setState("importing");
    try {
      const r = await api.executeImport(
        preview.folder_id,
        programName,
        targetMode === "new_block" ? targetProgramId : null,
        targetMode,
      );
      setResult(r);
      setState("complete");
      await loadPrograms();
      if (r.success) {
        toast.success(
          `Imported ${r.microcycles_created} days, ${r.exercises_imported} exercises`,
        );
      } else {
        toast.error(`Import completed with ${r.errors.length} error(s)`);
      }
    } catch (e) {
      setError(`${e}`);
      setState("error");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Import from Hevy</h2>

        {state === "loading" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <p style={{ color: "var(--text-secondary)" }}>
              Loading Hevy folders...
            </p>
          </div>
        )}

        {state === "folder-select" && (
          <>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                marginBottom: 8,
              }}
            >
              Select a folder to import ({folders.length} folders)
            </div>

            {folders.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                No folders found on your Hevy account.
              </div>
            ) : (
              <div
                style={{
                  maxHeight: 300,
                  overflowY: "auto",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                {folders.map((f) => (
                  <label
                    key={f.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderBottom: "1px solid var(--border)",
                      cursor: f.already_linked ? "default" : "pointer",
                      opacity: f.already_linked ? 0.5 : 1,
                      background:
                        selectedFolderId === f.id
                          ? "rgba(59, 130, 246, 0.1)"
                          : "transparent",
                    }}
                  >
                    <input
                      type="radio"
                      name="folder"
                      disabled={f.already_linked}
                      checked={selectedFolderId === f.id}
                      onChange={() => setSelectedFolderId(f.id)}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {f.title}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {f.routine_count} routine
                        {f.routine_count !== 1 ? "s" : ""}
                        {f.already_linked &&
                          ` - Linked to "${f.linked_program_name}"`}
                      </div>
                    </div>
                    {f.already_linked && (
                      <span className="badge badge-neutral">Linked</span>
                    )}
                  </label>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={selectedFolderId === null}
                onClick={handleSelectFolder}
              >
                Next
              </button>
            </div>
          </>
        )}

        {state === "preview-loading" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <p style={{ color: "var(--text-secondary)" }}>
              Loading routine details...
            </p>
          </div>
        )}

        {state === "preview" && preview && (
          <>
            {/* Program name */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Program Name
              </label>
              <input
                type="text"
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  fontSize: 14,
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            {/* Import mode */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  display: "block",
                  marginBottom: 8,
                }}
              >
                Import as
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className={`btn ${targetMode === "new_program" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setTargetMode("new_program")}
                  style={{ flex: 1 }}
                >
                  New Program
                </button>
                <button
                  className={`btn ${targetMode === "new_block" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setTargetMode("new_block")}
                  style={{ flex: 1 }}
                >
                  Block in Existing Program
                </button>
              </div>
            </div>

            {/* Target program selector */}
            {targetMode === "new_block" && (
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Target Program
                </label>
                <select
                  value={targetProgramId ?? ""}
                  onChange={(e) =>
                    setTargetProgramId(e.target.value || null)
                  }
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    fontSize: 14,
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    background: "var(--bg-primary)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="">Select a program...</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Week/day structure preview */}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  marginBottom: 8,
                }}
              >
                Structure ({preview.routines.length} routine
                {preview.routines.length !== 1 ? "s" : ""})
              </div>
              <div
                style={{
                  maxHeight: 240,
                  overflowY: "auto",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              >
                {preview.weeks.map((week) => (
                  <div key={week.week_number}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "6px 12px",
                        background: "var(--bg-secondary)",
                        borderBottom: "1px solid var(--border)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Week {week.week_number}
                    </div>
                    {week.days.map((day) => (
                      <div
                        key={day.hevy_routine_id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 12px 6px 24px",
                          borderBottom: "1px solid var(--border)",
                          fontSize: 13,
                        }}
                      >
                        <span>
                          Day {day.day_number} - {day.routine_title}
                        </span>
                        <span
                          style={{ fontSize: 11, color: "var(--text-muted)" }}
                        >
                          {day.exercise_count} ex, {day.set_count} sets
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setPreview(null);
                  setState("folder-select");
                }}
              >
                Back
              </button>
              <button
                className="btn btn-primary"
                disabled={
                  !programName.trim() ||
                  (targetMode === "new_block" && !targetProgramId)
                }
                onClick={handleImport}
              >
                Import
              </button>
            </div>
          </>
        )}

        {state === "importing" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <p style={{ color: "var(--text-secondary)" }}>
              Importing from Hevy...
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Creating program structure and exercises
            </p>
          </div>
        )}

        {state === "complete" && result && (
          <>
            <div style={{ marginBottom: 16 }}>
              {result.success ? (
                <div
                  style={{
                    padding: 12,
                    background: "rgba(34, 197, 94, 0.1)",
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    Import Complete
                  </div>
                  <div>
                    Created "{result.program_name}" with{" "}
                    {result.microcycles_created} days and{" "}
                    {result.exercises_imported} exercises
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: 12,
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    Import completed with errors
                  </div>
                  <div>
                    {result.microcycles_created} days,{" "}
                    {result.exercises_imported} exercises
                  </div>
                  {result.errors.map((err, i) => (
                    <div
                      key={i}
                      style={{
                        color: "var(--error)",
                        marginTop: 4,
                        fontSize: 12,
                      }}
                    >
                      {err}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
              {result.success && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    onClose();
                    navigate(`/program/${result.program_id}`);
                  }}
                >
                  Open Program
                </button>
              )}
            </div>
          </>
        )}

        {state === "error" && (
          <>
            <div
              style={{
                padding: 12,
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Error</div>
              <div style={{ color: "var(--error)" }}>
                {error || "An unexpected error occurred"}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
