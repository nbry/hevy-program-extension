import { useState, useEffect } from "react";
import { toast } from "sonner";
import * as api from "../../lib/tauri";
import type { SyncPreview, SyncResultData } from "../../lib/tauri";

interface SyncModalProps {
  programId: string;
  onClose: () => void;
  onSyncComplete: () => void;
}

type ModalState = "loading" | "preview" | "syncing" | "complete" | "error";

export function SyncModal({
  programId,
  onClose,
  onSyncComplete,
}: SyncModalProps) {
  const [state, setState] = useState<ModalState>("loading");
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [result, setResult] = useState<SyncResultData | null>(null);
  const [renameOrphans, setRenameOrphans] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .previewSync(programId)
      .then((p) => {
        setPreview(p);
        setState("preview");
      })
      .catch((e) => {
        setLoadError(`${e}`);
        setState("error");
      });
  }, [programId]);

  const handleSync = async () => {
    setState("syncing");
    try {
      const r = await api.executeSync(programId, renameOrphans);
      setResult(r);
      setState("complete");
      if (r.success) {
        toast.success(
          `Synced to Hevy: ${r.created} created, ${r.updated} updated`,
        );
      } else {
        toast.error(`Sync completed with ${r.errors.length} error(s)`);
      }
      onSyncComplete();
    } catch (e) {
      setLoadError(`${e}`);
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
        <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Push to Hevy</h2>

        {state === "loading" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <p style={{ color: "var(--text-secondary)" }}>
              Preparing sync preview...
            </p>
          </div>
        )}

        {state === "preview" && preview && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  marginBottom: 4,
                }}
              >
                Hevy Folder
              </div>
              <div style={{ fontWeight: 600 }}>{preview.folder_name}</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  marginBottom: 8,
                }}
              >
                Routines ({preview.routines.length})
              </div>
              <div
                style={{
                  maxHeight: 240,
                  overflowY: "auto",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              >
                {preview.routines.map((r) => (
                  <div
                    key={r.microcycle_id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderBottom: "1px solid var(--border)",
                      fontSize: 13,
                    }}
                  >
                    <span>{r.name}</span>
                    <span
                      className={
                        r.is_update ? "badge badge-neutral" : "badge badge-success"
                      }
                    >
                      {r.is_update ? "UPDATE" : "NEW"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {preview.total_create > 0 || preview.total_update > 0 ? (
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  marginBottom: 16,
                }}
              >
                {preview.total_create > 0 && (
                  <span>{preview.total_create} to create</span>
                )}
                {preview.total_create > 0 && preview.total_update > 0 && (
                  <span> &middot; </span>
                )}
                {preview.total_update > 0 && (
                  <span>{preview.total_update} to update</span>
                )}
              </div>
            ) : null}

            {preview.orphaned_routines.length > 0 && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 12,
                  background: "rgba(245, 158, 11, 0.1)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--warning)",
                    marginBottom: 8,
                  }}
                >
                  Orphaned Routines ({preview.orphaned_routines.length})
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginBottom: 8,
                  }}
                >
                  These routines exist in Hevy but their corresponding days were
                  removed from the program. Hevy does not support deleting
                  routines via API - you must delete them manually in the Hevy
                  app.
                </div>
                {preview.orphaned_routines.map((o) => (
                  <div
                    key={o.hevy_routine_id}
                    style={{ fontSize: 12, padding: "2px 0" }}
                  >
                    {o.name}
                  </div>
                ))}
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 8,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={renameOrphans}
                    onChange={(e) => setRenameOrphans(e.target.checked)}
                  />
                  Rename with [REMOVED] prefix
                </label>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSync}>
                Push to Hevy
              </button>
            </div>
          </>
        )}

        {state === "syncing" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <p style={{ color: "var(--text-secondary)" }}>
              Syncing to Hevy...
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Creating folder and routines
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
                    Sync Complete
                  </div>
                  <div>
                    {result.created} created, {result.updated} updated
                    {result.orphans_renamed > 0 &&
                      `, ${result.orphans_renamed} orphans renamed`}
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
                    Sync completed with errors
                  </div>
                  <div>
                    {result.created} created, {result.updated} updated
                  </div>
                  {result.errors.map((err, i) => (
                    <div
                      key={i}
                      style={{ color: "var(--error)", marginTop: 4, fontSize: 12 }}
                    >
                      {err}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary" onClick={onClose}>
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
                {loadError || "An unexpected error occurred"}
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
