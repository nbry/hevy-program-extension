import { create } from "zustand";
import type { Program, ProgramFull, TrainingMax, Block, Mesocycle, Microcycle } from "../types";
import * as api from "../lib/tauri";

interface ProgramState {
  programs: Program[];
  programsLoaded: boolean;

  activeProgram: ProgramFull | null;
  activeBlockIndex: number;
  activeMesocycleIndex: number;
  activeMicrocycleId: string | null;

  trainingMaxes: Map<string, TrainingMax>;
  isDirty: boolean;

  loadPrograms: () => Promise<void>;
  loadProgram: (id: string) => Promise<void>;
  createProgram: (name: string, description?: string) => Promise<string>;
  deleteProgram: (id: string) => Promise<void>;

  setActiveBlock: (index: number) => void;
  setActiveMesocycle: (index: number) => void;
  setActiveMicrocycle: (id: string | null) => void;

  addBlock: (name: string) => Promise<void>;
  addMesocycle: (blockId: string, name: string, weekNumber: number) => Promise<void>;
  addMicrocycle: (mesocycleId: string, name: string, dayNumber: number) => Promise<void>;
  deleteBlock: (blockId: string) => Promise<void>;
  deleteMesocycle: (mesocycleId: string) => Promise<void>;
  deleteMicrocycle: (microcycleId: string) => Promise<void>;
  duplicateMesocycle: (mesocycleId: string) => Promise<void>;

  loadTrainingMaxes: () => Promise<void>;
  markDirty: () => void;
  markClean: () => void;
  refreshActiveProgram: () => Promise<void>;

  getActiveBlock: () => Block | null;
  getActiveMesocycle: () => Mesocycle | null;
  getActiveMicrocycle: () => Microcycle | null;
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
    set({ activeBlockIndex: index, activeMesocycleIndex: 0, activeMicrocycleId: firstMicrocycleId });
  },

  setActiveMesocycle: (index) => {
    const { activeProgram, activeBlockIndex } = get();
    if (!activeProgram) return;
    const mesocycle = activeProgram.blocks[activeBlockIndex]?.mesocycles[index];
    const firstMicrocycleId = mesocycle?.microcycles[0]?.id ?? null;
    set({ activeMesocycleIndex: index, activeMicrocycleId: firstMicrocycleId });
  },

  setActiveMicrocycle: (id) => set({ activeMicrocycleId: id }),

  addBlock: async (name) => {
    const { activeProgram } = get();
    if (!activeProgram) return;
    await api.addBlock(activeProgram.id, name);
    await get().refreshActiveProgram();
  },

  addMesocycle: async (blockId, name, weekNumber) => {
    await api.addMesocycle(blockId, name, weekNumber);
    await get().refreshActiveProgram();
  },

  addMicrocycle: async (mesocycleId, name, dayNumber) => {
    await api.addMicrocycle(mesocycleId, name, dayNumber);
    await get().refreshActiveProgram();
  },

  deleteBlock: async (blockId) => {
    await api.deleteBlock(blockId);
    await get().refreshActiveProgram();
    const blocks = get().activeProgram?.blocks ?? [];
    get().setActiveBlock(Math.min(get().activeBlockIndex, Math.max(0, blocks.length - 1)));
  },

  deleteMesocycle: async (mesocycleId) => {
    await api.deleteMesocycle(mesocycleId);
    await get().refreshActiveProgram();
    get().setActiveMesocycle(0);
  },

  deleteMicrocycle: async (microcycleId) => {
    await api.deleteMicrocycle(microcycleId);
    await get().refreshActiveProgram();
    const meso = get().getActiveMesocycle();
    set({ activeMicrocycleId: meso?.microcycles[0]?.id ?? null });
  },

  duplicateMesocycle: async (mesocycleId) => {
    await api.duplicateMesocycle(mesocycleId);
    await get().refreshActiveProgram();
  },

  loadTrainingMaxes: async () => {
    const { activeProgram } = get();
    if (!activeProgram) return;
    try {
      const maxes = await api.getTrainingMaxes(activeProgram.id);
      const map = new Map<string, TrainingMax>();
      for (const tm of maxes) map.set(tm.exercise_template_id, tm);
      set({ trainingMaxes: map });
    } catch { /* none yet */ }
  },

  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),

  refreshActiveProgram: async () => {
    const { activeProgram } = get();
    if (!activeProgram) return;
    const program = await api.getProgram(activeProgram.id);
    set({ activeProgram: program });
  },

  getActiveBlock: () => {
    const { activeProgram, activeBlockIndex } = get();
    return activeProgram?.blocks[activeBlockIndex] ?? null;
  },

  getActiveMesocycle: () => {
    const { activeProgram, activeBlockIndex, activeMesocycleIndex } = get();
    return activeProgram?.blocks[activeBlockIndex]?.mesocycles[activeMesocycleIndex] ?? null;
  },

  getActiveMicrocycle: () => {
    const { activeMicrocycleId } = get();
    if (!activeMicrocycleId) return null;
    const meso = get().getActiveMesocycle();
    return meso?.microcycles.find((m) => m.id === activeMicrocycleId) ?? null;
  },
}));
