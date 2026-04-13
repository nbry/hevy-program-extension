import { create } from "zustand";
import type { UnitSystem, UserSettings } from "../types";
import * as api from "../lib/tauri";

interface SettingsState {
  unitSystem: UnitSystem;
  hevyUserId: string | null;
  hevyUsername: string | null;
  apiKeyConfigured: boolean;
  exerciseCacheUpdatedAt: string | null;
  loaded: boolean;

  loadSettings: () => Promise<void>;
  setUnitSystem: (system: UnitSystem) => Promise<void>;
  setApiKeyConfigured: (configured: boolean) => void;
  setHevyUser: (id: string | null, name: string | null) => void;
  setExerciseCacheUpdatedAt: (date: string | null) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  unitSystem: "metric",
  hevyUserId: null,
  hevyUsername: null,
  apiKeyConfigured: false,
  exerciseCacheUpdatedAt: null,
  loaded: false,

  loadSettings: async () => {
    try {
      const settings: UserSettings = await api.getSettings();
      set({
        unitSystem: settings.unit_system,
        hevyUserId: settings.hevy_user_id,
        hevyUsername: settings.hevy_username,
        apiKeyConfigured: settings.api_key_configured,
        exerciseCacheUpdatedAt: settings.exercise_cache_updated_at,
        loaded: true,
      });
    } catch {
      // Settings not loaded yet (first launch)
      set({ loaded: true });
    }
  },

  setUnitSystem: async (system) => {
    set({ unitSystem: system });
    await api.updateSettings({ unit_system: system });
  },

  setApiKeyConfigured: (configured) => {
    set({ apiKeyConfigured: configured });
  },

  setHevyUser: (id, name) => {
    set({ hevyUserId: id, hevyUsername: name });
  },

  setExerciseCacheUpdatedAt: (date) => {
    set({ exerciseCacheUpdatedAt: date });
  },
}));
