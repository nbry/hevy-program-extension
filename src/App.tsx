import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import { Toaster } from "sonner";
import { AppShell } from "./components/layout/AppShell";
import { ApiKeyPrompt } from "./components/setup/ApiKeyPrompt";
import { HomePage } from "./pages/HomePage";
import { ProgramPage } from "./pages/ProgramPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TrainingMaxPage } from "./pages/TrainingMaxPage";
import { useSettingsStore } from "./stores/settingsStore";
import { useExerciseStore } from "./stores/exerciseStore";
import { useProgramStore } from "./stores/programStore";

function App() {
  const { loaded, apiKeyConfigured, loadSettings } = useSettingsStore();
  const { loadTemplates, syncIfStale } = useExerciseStore();
  const { loadGlobalTrainingMaxes } = useProgramStore();
  const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (loaded) {
      if (!apiKeyConfigured) {
        setShowApiKeyPrompt(true);
      } else {
        loadTemplates();
        syncIfStale();
        loadGlobalTrainingMaxes();
      }
    }
  }, [
    loaded,
    apiKeyConfigured,
    loadTemplates,
    syncIfStale,
    loadGlobalTrainingMaxes,
  ]);

  // Global zoom keyboard shortcuts (Ctrl+/-, Ctrl+0)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        const s = useSettingsStore.getState();
        s.setZoomLevel(s.zoomLevel + 0.1);
      } else if (e.key === "-") {
        e.preventDefault();
        const s = useSettingsStore.getState();
        s.setZoomLevel(s.zoomLevel - 0.1);
      } else if (e.key === "0") {
        e.preventDefault();
        useSettingsStore.getState().setZoomLevel(1.0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!loaded) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <span style={{ color: "var(--text-secondary)" }}>Loading...</span>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          },
        }}
      />

      {showApiKeyPrompt && (
        <ApiKeyPrompt
          onComplete={() => {
            setShowApiKeyPrompt(false);
            loadTemplates();
          }}
        />
      )}

      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/program/:id" element={<ProgramPage />} />
          <Route path="/training-maxes" element={<TrainingMaxPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}

export default App;
