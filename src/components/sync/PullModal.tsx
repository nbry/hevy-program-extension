import { useState, useEffect } from "react";
import { toast } from "sonner";
import * as api from "../../lib/tauri";
import type { PullPreview, PullResult } from "../../lib/tauri";

interface PullModalProps {
  programId: string;
  onClose: () => void;
  onPullComplete: () => void;
}

type ModalState = "loading" | "preview" | "pulling" | "complete" | "error";

export function PullModal({
  programId,
  onClose,
  onPullComplete,
}: PullModalProps) {
  const [state, setState] = useState<ModalState>("loading");
  const [preview, setPreview] = useState<PullPreview | null>(null);
  const [result, setResult] = useState<PullResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    api
      .previewPull(programId)
      .then((p) => {
        setPreview(p);
        // Pre-select all changed microcycles
        setSelectedIds(
          new Set(p.changes.filter((c) => c.has_changes).map((c) => c.microcycle_id)),
        );
        setState("preview");
      })
      .catch((e) => {
        setError(`${e}`);
        setState("error");
      });
  }, [programId]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handlePull = async () => {
    setState("pulling");
    try {
      const r = await api.executePull(programId, Array.from(selectedIds));
      setResult(r);
      setState("complete");
      if (r.success) {
        toast.success(`Pulled ${r.updated_microcycles} routine(s) from Hevy`);
      } else {
        toast.error(`Pull completed with ${r.errors.length} error(s)`);
      }
      onPullComplete();
    } catch (e) {
      setError(`${e}`);
      setState("error");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 540 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Pull from Hevy</h2>

        {state === "loading" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <p style={{ color: "var(--text-secondary)" }}>
              Comparing local and remote routines...
            </p>
          </div>
        )}

        {state === "preview" && preview && (
          <>
            {preview.changes.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                }}
              >
                Everything is up to date. No changes found on Hevy.
                {preview.unchanged.length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    {preview.unchanged.length} routine
                    {preview.unchanged.length !== 1 ? "s" : ""} unchanged
                  </div>
                )}
              </div>
            ) : (
              <>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    marginBottom: 8,
                  }}
                >
                  {preview.changes.length} routine
                  {preview.changes.length !== 1 ? "s" : ""} with changes
                  {preview.unchanged.length > 0 &&
                    `, ${preview.unchanged.length} unchanged`}
                </div>

                <div
                  style={{
                    maxHeight: 300,
                    overflowY: "auto",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    marginBottom: 16,
                  }}
                >
                  {preview.changes.map((change) => (
                    <label
                      key={change.microcycle_id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderBottom: "1px solid var(--border)",
                        cursor: change.has_changes ? "pointer" : "default",
                        opacity: change.has_changes ? 1 : 0.5,
                        background: selectedIds.has(change.microcycle_id)
                          ? "rgba(59, 130, 246, 0.1)"
                          : "transparent",
                      }}
                    >
                      <input
                        type="checkbox"
                        disabled={!change.has_changes}
                        checked={selectedIds.has(change.microcycle_id)}
                        onChange={() => toggleSelect(change.microcycle_id)}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {change.microcycle_name}
                        </div>
                        <div
                          style={{ fontSize: 11, color: "var(--text-muted)" }}
                        >
                          Local: {change.local_exercise_count} exercises,{" "}
                          {change.local_set_count} sets | Remote:{" "}
                          {change.remote_exercise_count} exercises,{" "}
                          {change.remote_set_count} sets
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginBottom: 16,
                    padding: "8px 12px",
                    background: "rgba(234, 179, 8, 0.1)",
                    border: "1px solid rgba(234, 179, 8, 0.3)",
                    borderRadius: 8,
                  }}
                >
                  Pulling will replace local exercises and sets with the Hevy
                  version for selected routines.
                </div>
              </>
            )}

            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button className="btn btn-secondary" onClick={onClose}>
                {preview.changes.length === 0 ? "Close" : "Cancel"}
              </button>
              {preview.changes.length > 0 && (
                <button
                  className="btn btn-primary"
                  disabled={selectedIds.size === 0}
                  onClick={handlePull}
                >
                  Pull {selectedIds.size} Routine
                  {selectedIds.size !== 1 ? "s" : ""}
                </button>
              )}
            </div>
          </>
        )}

        {state === "pulling" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <p style={{ color: "var(--text-secondary)" }}>
              Pulling changes from Hevy...
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Updating local exercises and sets
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
                    Pull Complete
                  </div>
                  <div>
                    Updated {result.updated_microcycles} routine
                    {result.updated_microcycles !== 1 ? "s" : ""} from Hevy
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
                    Pull completed with errors
                  </div>
                  <div>
                    Updated {result.updated_microcycles} routine
                    {result.updated_microcycles !== 1 ? "s" : ""}
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

            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
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
