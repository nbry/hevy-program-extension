import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import { Toaster } from "sonner";
import { AppShell } from "./components/layout/AppShell";
import { ApiKeyPrompt } from "./components/setup/ApiKeyPrompt";
import { HomePage } from "./pages/HomePage";
import { ProgramPage } from "./pages/ProgramPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useSettingsStore } from "./stores/settingsStore";
import { useExerciseStore } from "./stores/exerciseStore";

function App() {
  const { loaded, apiKeyConfigured, loadSettings } = useSettingsStore();
  const { loadTemplates } = useExerciseStore();
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
      }
    }
  }, [loaded, apiKeyConfigured, loadTemplates]);

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
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}

export default App;
