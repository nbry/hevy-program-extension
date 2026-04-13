import { create } from "zustand";
import type { ExerciseTemplate } from "../types";
import * as api from "../lib/tauri";

interface ExerciseState {
  templates: ExerciseTemplate[];
  loaded: boolean;
  syncing: boolean;

  loadTemplates: () => Promise<void>;
  syncFromHevy: () => Promise<{ added: number; updated: number }>;
  search: (query: string) => ExerciseTemplate[];
}

export const useExerciseStore = create<ExerciseState>((set, get) => ({
  templates: [],
  loaded: false,
  syncing: false,

  loadTemplates: async () => {
    try {
      const templates = await api.getExerciseTemplates();
      set({ templates, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  syncFromHevy: async () => {
    set({ syncing: true });
    try {
      const result = await api.syncExerciseTemplates();
      // Reload after sync
      const templates = await api.getExerciseTemplates();
      set({ templates, syncing: false });
      return result;
    } catch (e) {
      set({ syncing: false });
      throw e;
    }
  },

  search: (query: string) => {
    const { templates } = get();
    if (!query.trim()) return templates.slice(0, 20);

    const lower = query.toLowerCase();
    const matches = templates.filter((t) =>
      t.title.toLowerCase().includes(lower),
    );

    // Sort: prefix matches first, then by title
    matches.sort((a, b) => {
      const aPrefix = a.title.toLowerCase().startsWith(lower) ? 0 : 1;
      const bPrefix = b.title.toLowerCase().startsWith(lower) ? 0 : 1;
      if (aPrefix !== bPrefix) return aPrefix - bPrefix;
      return a.title.localeCompare(b.title);
    });

    return matches.slice(0, 20);
  },
}));
