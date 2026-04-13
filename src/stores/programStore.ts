import { create } from "zustand";
import type { Program, ProgramFull, TrainingMax } from "../types";
import * as api from "../lib/tauri";

interface ProgramState {
  // Program list
  programs: Program[];
  programsLoaded: boolean;

  // Active program
  activeProgram: ProgramFull | null;
  activeBlockIndex: number;
  activeMesocycleIndex: number;
  activeMicrocycleId: string | null;

  // Training maxes for active program
  trainingMaxes: Map<string, TrainingMax>;

  // Dirty tracking
  isDirty: boolean;

  // Actions
  loadPrograms: () => Promise<void>;
  loadProgram: (id: string) => Promise<void>;
  createProgram: (name: string, description?: string) => Promise<string>;
  deleteProgram: (id: string) => Promise<void>;

  setActiveBlock: (index: number) => void;
  setActiveMesocycle: (index: number) => void;
  setActiveMicrocycle: (id: string | null) => void;

  loadTrainingMaxes: () => Promise<void>;

  markDirty: () => void;
  markClean: () => void;

  refreshActiveProgram: () => Promise<void>;
}

export const useProgramStore = create<ProgramState>((set, get) => ({
  programs: [],
  programsLoaded: false,
  activeProgram: null,
  activeBlockIndex: 0,
  activeMesocycleIndex: 0,
  activeMicrocycleId: null,
  trainingMaxes: new Map(),
  isDirty: false,

  loadPrograms: async () => {
    const programs = await api.getPrograms();
    set({ programs, programsLoaded: true });
  },

  loadProgram: async (id: string) => {
    const program = await api.getProgram(id);
    const firstMicrocycleId =
      program.blocks[0]?.mesocycles[0]?.microcycles[0]?.id ?? null;

    set({
      activeProgram: program,
      activeBlockIndex: 0,
      activeMesocycleIndex: 0,
      activeMicrocycleId: firstMicrocycleId,
      isDirty: false,
    });

    // Load training maxes for this program
    get().loadTrainingMaxes();
  },

  createProgram: async (name, description) => {
    const program = await api.createProgram(name, description);
    const { programs } = get();
    set({ programs: [program, ...programs] });
    return program.id;
  },

  deleteProgram: async (id: string) => {
    await api.deleteProgram(id);
    const { programs, activeProgram } = get();
    set({
      programs: programs.filter((p) => p.id !== id),
      activeProgram: activeProgram?.id === id ? null : activeProgram,
    });
  },

  setActiveBlock: (index) => {
    const { activeProgram } = get();
    if (!activeProgram) return;

    const block = activeProgram.blocks[index];
    const firstMicrocycleId = block?.mesocycles[0]?.microcycles[0]?.id ?? null;

    set({
      activeBlockIndex: index,
      activeMesocycleIndex: 0,
      activeMicrocycleId: firstMicrocycleId,
    });
  },

  setActiveMesocycle: (index) => {
    const { activeProgram, activeBlockIndex } = get();
    if (!activeProgram) return;

    const mesocycle = activeProgram.blocks[activeBlockIndex]?.mesocycles[index];
    const firstMicrocycleId = mesocycle?.microcycles[0]?.id ?? null;

    set({
      activeMesocycleIndex: index,
      activeMicrocycleId: firstMicrocycleId,
    });
  },

  setActiveMicrocycle: (id) => {
    set({ activeMicrocycleId: id });
  },

  loadTrainingMaxes: async () => {
    const { activeProgram } = get();
    if (!activeProgram) return;

    try {
      const maxes = await api.getTrainingMaxes(activeProgram.id);
      const map = new Map<string, TrainingMax>();
      for (const tm of maxes) {
        map.set(tm.exercise_template_id, tm);
      }
      set({ trainingMaxes: map });
    } catch {
      // No training maxes yet
    }
  },

  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),

  refreshActiveProgram: async () => {
    const { activeProgram } = get();
    if (!activeProgram) return;
    const program = await api.getProgram(activeProgram.id);
    set({ activeProgram: program });
  },
}));
