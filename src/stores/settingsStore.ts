import { create } from "zustand";
import type {
  UnitSystem,
  MinimumIncrements,
  EquipmentCategory,
} from "../types";
import * as api from "../lib/tauri";

const DEFAULT_INCREMENTS: MinimumIncrements = {
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

interface SettingsState {
  unitSystem: UnitSystem;
  hevyUserId: string | null;
  hevyUsername: string | null;
  apiKeyConfigured: boolean;
  exerciseCacheUpdatedAt: string | null;
  zoomLevel: number;
  minimumIncrements: MinimumIncrements;
  defaultIncrementKg: number;
  loaded: boolean;

  loadSettings: () => Promise<void>;
  setUnitSystem: (system: UnitSystem) => Promise<void>;
  setZoomLevel: (level: number) => Promise<void>;
  setApiKeyConfigured: (configured: boolean) => void;
  setHevyUser: (id: string | null, name: string | null) => void;
  setExerciseCacheUpdatedAt: (date: string | null) => void;
  setMinimumIncrements: (increments: MinimumIncrements) => Promise<void>;
  setDefaultIncrementKg: (kg: number) => Promise<void>;
  getIncrementForEquipment: (equipment: EquipmentCategory | null) => number;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  unitSystem: "metric",
  hevyUserId: null,
  hevyUsername: null,
  apiKeyConfigured: false,
  exerciseCacheUpdatedAt: null,
  zoomLevel: 1.0,
  minimumIncrements: { ...DEFAULT_INCREMENTS },
  defaultIncrementKg: 2.5,
  loaded: false,

  loadSettings: async () => {
    try {
      const settings = await api.getSettings();
      const zl = settings.zoom_level ?? 1.0;
      (document.documentElement.style as any).zoom = String(zl);
      set({
        unitSystem: settings.unit_system,
        hevyUserId: settings.hevy_user_id,
        hevyUsername: settings.hevy_username,
        apiKeyConfigured: settings.api_key_configured,
        exerciseCacheUpdatedAt: settings.exercise_cache_updated_at,
        zoomLevel: zl,
        minimumIncrements: settings.minimum_increments_kg ?? {
          ...DEFAULT_INCREMENTS,
        },
        defaultIncrementKg: settings.default_increment_kg ?? 2.5,
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

  setZoomLevel: async (level) => {
    const clamped = Math.round(Math.max(0.5, Math.min(2.0, level)) * 100) / 100;
    set({ zoomLevel: clamped });
    (document.documentElement.style as any).zoom = String(clamped);
    await api.updateSettings({ zoom_level: clamped });
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

  setMinimumIncrements: async (increments) => {
    set({ minimumIncrements: increments });
    await api.updateSettings({ minimum_increments_kg: increments });
  },

  setDefaultIncrementKg: async (kg) => {
    set({ defaultIncrementKg: kg });
    await api.updateSettings({ default_increment_kg: kg });
  },

  getIncrementForEquipment: (equipment) => {
    const { minimumIncrements, defaultIncrementKg } = get();
    if (!equipment) return defaultIncrementKg;
    return minimumIncrements[equipment] ?? defaultIncrementKg;
  },
}));
