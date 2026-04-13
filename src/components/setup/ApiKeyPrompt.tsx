import { useState } from "react";
import { toast } from "sonner";
import * as api from "../../lib/tauri";
import { useSettingsStore } from "../../stores/settingsStore";

interface ApiKeyPromptProps {
  onComplete: () => void;
}

export function ApiKeyPrompt({ onComplete }: ApiKeyPromptProps) {
  const [key, setKey] = useState("");
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setApiKeyConfigured, setHevyUser } = useSettingsStore();

  const handleSubmit = async () => {
    if (!key.trim()) {
      setError("Please enter your API key");
      return;
    }

    setValidating(true);
    setError(null);

    try {
      // Validate key with Hevy API
      const userInfo = await api.validateApiKey(key.trim());

      // Store key securely
      await api.storeApiKey(key.trim());

      setApiKeyConfigured(true);
      setHevyUser(userInfo.id, userInfo.name);
      toast.success(`Connected as ${userInfo.name}`);
      onComplete();
    } catch (e) {
      setError(`Invalid API key: ${e}`);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 480 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          Connect to Hevy
        </h2>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: 13,
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          Enter your Hevy API key to get started. You can find it in your{" "}
          <span style={{ color: "var(--accent)" }}>
            Hevy Settings &gt; Developer
          </span>{" "}
          section.
          <br />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Requires Hevy Pro subscription.
          </span>
        </p>

        <div style={{ marginBottom: 16 }}>
          <input
            type="password"
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="Your Hevy API key (UUID format)"
            style={{
              width: "100%",
              fontFamily: "monospace",
              fontSize: 13,
            }}
            autoFocus
          />
        </div>

        {error && (
          <p style={{ color: "var(--error)", fontSize: 12, marginBottom: 12 }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={validating || !key.trim()}
            style={{ opacity: validating || !key.trim() ? 0.5 : 1 }}
          >
            {validating ? "Validating..." : "Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}
