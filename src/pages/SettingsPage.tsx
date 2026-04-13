import { useState } from "react";
import { toast } from "sonner";
import * as api from "../lib/tauri";
import { useSettingsStore } from "../stores/settingsStore";
import { useExerciseStore } from "../stores/exerciseStore";

export function SettingsPage() {
  const {
    unitSystem,
    hevyUsername,
    apiKeyConfigured,
    exerciseCacheUpdatedAt,
    setUnitSystem,
    setApiKeyConfigured,
    setHevyUser,
    setExerciseCacheUpdatedAt,
  } = useSettingsStore();

  const { templates, syncing, syncFromHevy } = useExerciseStore();

  const [changingKey, setChangingKey] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [validating, setValidating] = useState(false);

  const handleRemoveKey = async () => {
    try {
      await api.removeApiKey();
      setApiKeyConfigured(false);
      setHevyUser(null, null);
      toast.success("API key removed");
    } catch (e) {
      toast.error(`Failed to remove key: ${e}`);
    }
  };

  const handleUpdateKey = async () => {
    if (!newKey.trim()) return;
    setValidating(true);
    try {
      const userInfo = await api.validateApiKey(newKey.trim());
      await api.storeApiKey(newKey.trim());
      setApiKeyConfigured(true);
      setHevyUser(userInfo.id, userInfo.name);
      setChangingKey(false);
      setNewKey("");
      toast.success(`Connected as ${userInfo.name}`);
    } catch (e) {
      toast.error(`Invalid API key: ${e}`);
    } finally {
      setValidating(false);
    }
  };

  const handleSyncExercises = async () => {
    try {
      const result = await syncFromHevy();
      setExerciseCacheUpdatedAt(new Date().toISOString());
      toast.success(
        `Synced exercises: ${result.added} added, ${result.updated} updated`,
      );
    } catch (e) {
      toast.error(`Failed to sync exercises: ${e}`);
    }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>
        Settings
      </h2>

      {/* API Key Section */}
      <section style={{ marginBottom: 32 }}>
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 12,
            color: "var(--text-secondary)",
          }}
        >
          Hevy Connection
        </h3>
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 16,
          }}
        >
          {apiKeyConfigured ? (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <span className="badge badge-success">Connected</span>
                {hevyUsername && (
                  <span
                    style={{ fontSize: 13, color: "var(--text-secondary)" }}
                  >
                    as {hevyUsername}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setChangingKey(true)}
                >
                  Change Key
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleRemoveKey}
                >
                  Remove Key
                </button>
              </div>
            </div>
          ) : (
            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
              No API key configured
            </span>
          )}

          {changingKey && (
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <input
                type="password"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUpdateKey();
                }}
                placeholder="New API key..."
                style={{ flex: 1, fontFamily: "monospace", fontSize: 13 }}
                autoFocus
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={handleUpdateKey}
                disabled={validating}
              >
                {validating ? "..." : "Save"}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setChangingKey(false);
                  setNewKey("");
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Units Section */}
      <section style={{ marginBottom: 32 }}>
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 12,
            color: "var(--text-secondary)",
          }}
        >
          Units
        </h3>
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 16,
            display: "flex",
            gap: 8,
          }}
        >
          <button
            className={`btn btn-sm ${unitSystem === "metric" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setUnitSystem("metric")}
          >
            Metric (kg)
          </button>
          <button
            className={`btn btn-sm ${unitSystem === "imperial" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setUnitSystem("imperial")}
          >
            Imperial (lbs)
          </button>
        </div>
      </section>

      {/* Exercise Cache Section */}
      <section style={{ marginBottom: 32 }}>
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 12,
            color: "var(--text-secondary)",
          }}
        >
          Exercise Library
        </h3>
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: 13, marginBottom: 4 }}>
                {templates.length} exercises cached
              </div>
              {exerciseCacheUpdatedAt && (
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Last synced:{" "}
                  {new Date(exerciseCacheUpdatedAt).toLocaleString()}
                </div>
              )}
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleSyncExercises}
              disabled={syncing || !apiKeyConfigured}
              style={{ opacity: syncing || !apiKeyConfigured ? 0.5 : 1 }}
            >
              {syncing ? "Syncing..." : "Sync from Hevy"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
