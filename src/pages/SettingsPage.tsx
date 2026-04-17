import { useCallback, useState } from "react";
import { toast } from "sonner";
import * as api from "../lib/tauri";
import { useSettingsStore } from "../stores/settingsStore";
import { useExerciseStore } from "../stores/exerciseStore";
import type { EquipmentCategory, MinimumIncrements } from "../types";
import { KG_TO_LBS, LBS_TO_KG } from "../lib/conversions";

export function SettingsPage() {
  const {
    unitSystem,
    hevyUsername,
    apiKeyConfigured,
    exerciseCacheUpdatedAt,
    zoomLevel,
    setUnitSystem,
    setZoomLevel,
    setApiKeyConfigured,
    setHevyUser,
    setExerciseCacheUpdatedAt,
    minimumIncrements,
    defaultIncrementKg,
    setMinimumIncrements,
    setDefaultIncrementKg,
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

      {/* Display / Zoom Section */}
      <section style={{ marginBottom: 32 }}>
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 12,
            color: "var(--text-secondary)",
          }}
        >
          Display
        </h3>
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setZoomLevel(zoomLevel - 0.1)}
              disabled={zoomLevel <= 0.5}
            >
              -
            </button>
            <span style={{ fontSize: 13, minWidth: 50, textAlign: "center" }}>
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setZoomLevel(zoomLevel + 0.1)}
              disabled={zoomLevel >= 2.0}
            >
              +
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setZoomLevel(1.0)}
            >
              Reset
            </button>
          </div>
          <div
            style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}
          >
            Ctrl + / Ctrl - to zoom, Ctrl 0 to reset
          </div>
        </div>
      </section>

      {/* Weight Increments Section */}
      <WeightIncrementsSection
        unitSystem={unitSystem}
        increments={minimumIncrements}
        defaultIncrement={defaultIncrementKg}
        onUpdateIncrements={setMinimumIncrements}
        onUpdateDefault={setDefaultIncrementKg}
      />

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

const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  machine: "Machine / Cable",
  kettlebell: "Kettlebell",
  plate: "Plate Loaded",
  other: "Other",
};

const DEFAULT_INCREMENTS_KG: MinimumIncrements = {
  barbell: 2.5,
  dumbbell: 2.0,
  machine: 5.0,
  kettlebell: 4.0,
  plate: 2.5,
  other: 2.5,
  none: 0,
  resistance_band: 0,
  suspension: 0,
};

const DEFAULT_INCREMENTS_LBS: MinimumIncrements = {
  barbell: 2.27, // ~5 lbs
  dumbbell: 2.27, // ~5 lbs
  machine: 2.27, // ~5 lbs
  kettlebell: 3.63, // ~8 lbs
  plate: 2.27, // ~5 lbs
  other: 2.27, // ~5 lbs
  none: 0,
  resistance_band: 0,
  suspension: 0,
};

function WeightIncrementsSection({
  unitSystem,
  increments,
  defaultIncrement,
  onUpdateIncrements,
  onUpdateDefault,
}: {
  unitSystem: string;
  increments: MinimumIncrements;
  defaultIncrement: number;
  onUpdateIncrements: (inc: MinimumIncrements) => Promise<void>;
  onUpdateDefault: (kg: number) => Promise<void>;
}) {
  const isImperial = unitSystem === "imperial";

  const displayValue = (kg: number): string => {
    if (isImperial) {
      const lbs = Math.round(kg * KG_TO_LBS * 100) / 100;
      // Show clean number: strip trailing zeros
      return String(parseFloat(lbs.toFixed(2)));
    }
    return String(kg);
  };

  const parseToKg = (val: string): number | null => {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) return null;
    if (isImperial) return Math.round(num * LBS_TO_KG * 10000) / 10000;
    return num;
  };

  const handleChange = useCallback(
    (equipment: EquipmentCategory, value: string) => {
      const kg = parseToKg(value);
      if (kg == null) return;
      const updated = { ...increments, [equipment]: kg };
      onUpdateIncrements(updated);
    },
    [increments, onUpdateIncrements, isImperial],
  );

  const handleDefaultChange = useCallback(
    (value: string) => {
      const kg = parseToKg(value);
      if (kg == null) return;
      onUpdateDefault(kg);
    },
    [onUpdateDefault, isImperial],
  );

  const handleReset = useCallback(() => {
    const defaults = isImperial ? DEFAULT_INCREMENTS_LBS : DEFAULT_INCREMENTS_KG;
    onUpdateIncrements({ ...defaults });
    onUpdateDefault(isImperial ? 2.27 : 2.5); // 5 lbs or 2.5 kg
  }, [onUpdateIncrements, onUpdateDefault, isImperial]);

  const unit = isImperial ? "lbs" : "kg";

  const inputStyle: React.CSSProperties = {
    width: 70,
    padding: "3px 6px",
    fontSize: 13,
    background: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    textAlign: "right",
  };

  return (
    <section style={{ marginBottom: 32 }}>
      <h3
        style={{
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 12,
          color: "var(--text-secondary)",
        }}
      >
        Weight Increments
      </h3>
      <div
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <p
          style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}
        >
          Minimum weight increment per equipment type. Used for rounding when
          calculating weights from %TM.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Object.entries(EQUIPMENT_LABELS).map(([key, label]) => (
            <div
              key={key}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <span
                style={{
                  fontSize: 13,
                  minWidth: 130,
                  color: "var(--text-primary)",
                }}
              >
                {label}
              </span>
              <input
                type="number"
                step="any"
                min="0"
                value={displayValue(increments[key as EquipmentCategory] ?? 0)}
                onChange={(e) =>
                  handleChange(key as EquipmentCategory, e.target.value)
                }
                style={inputStyle}
              />
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {unit}
              </span>
            </div>
          ))}
          <div
            style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 13,
                minWidth: 130,
                color: "var(--text-primary)",
                fontWeight: 500,
              }}
            >
              Default (unknown)
            </span>
            <input
              type="number"
              step="any"
              min="0"
              value={displayValue(defaultIncrement)}
              onChange={(e) => handleDefaultChange(e.target.value)}
              style={inputStyle}
            />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {unit}
            </span>
          </div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleReset}
          style={{ marginTop: 12, fontSize: 11 }}
        >
          Reset to defaults
        </button>
      </div>
    </section>
  );
}
