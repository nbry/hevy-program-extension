import { invoke } from "@tauri-apps/api/core";
import type {
  ExerciseTemplate,
  UserSettings,
  Program,
  ProgramFull,
  TrainingMax,
  SyncRecord,
} from "../types";

// API Key commands
export async function storeApiKey(key: string): Promise<void> {
  return invoke("store_api_key", { key });
}

export async function getApiKey(): Promise<string | null> {
  return invoke("get_api_key");
}

export async function removeApiKey(): Promise<void> {
  return invoke("remove_api_key");
}

export async function validateApiKey(
  key: string,
): Promise<{ id: string; name: string; url: string }> {
  return invoke("validate_api_key", { key });
}

// Settings commands
export async function getSettings(): Promise<UserSettings> {
  return invoke("get_settings");
}

export async function updateSettings(
  settings: Partial<UserSettings>,
): Promise<void> {
  return invoke("update_settings", { settings });
}

// Exercise template commands
export async function syncExerciseTemplates(): Promise<{
  added: number;
  updated: number;
}> {
  return invoke("sync_exercise_templates");
}

export async function getExerciseTemplates(): Promise<ExerciseTemplate[]> {
  return invoke("get_exercise_templates");
}

export async function searchExercises(
  query: string,
  limit: number = 20,
): Promise<ExerciseTemplate[]> {
  return invoke("search_exercises", { query, limit });
}

// Program commands
export async function getPrograms(): Promise<Program[]> {
  return invoke("get_programs");
}

export async function getProgram(id: string): Promise<ProgramFull> {
  return invoke("get_program", { id });
}

export async function createProgram(
  name: string,
  description?: string,
): Promise<Program> {
  return invoke("create_program", { name, description: description ?? null });
}

export async function updateProgram(
  id: string,
  name: string,
  description?: string,
): Promise<void> {
  return invoke("update_program", {
    id,
    name,
    description: description ?? null,
  });
}

export async function deleteProgram(id: string): Promise<void> {
  return invoke("delete_program", { id });
}

export async function duplicateProgram(id: string): Promise<Program> {
  return invoke("duplicate_program", { id });
}

// Block/Mesocycle/Microcycle commands
export async function addBlock(
  programId: string,
  name: string,
): Promise<{ id: string }> {
  return invoke("add_block", { programId, name });
}

export async function addMesocycle(
  blockId: string,
  name: string,
  weekNumber: number,
): Promise<{ id: string }> {
  return invoke("add_mesocycle", { blockId, name, weekNumber });
}

export async function addMicrocycle(
  mesocycleId: string,
  name: string,
  dayNumber: number,
): Promise<{ id: string }> {
  return invoke("add_microcycle", { mesocycleId, name, dayNumber });
}

export async function deleteBlock(id: string): Promise<void> {
  return invoke("delete_block", { id });
}

export async function deleteMesocycle(id: string): Promise<void> {
  return invoke("delete_mesocycle", { id });
}

export async function deleteMicrocycle(id: string): Promise<void> {
  return invoke("delete_microcycle", { id });
}

export async function renameBlock(id: string, name: string): Promise<void> {
  return invoke("rename_block", { id, name });
}

export async function renameMesocycle(
  id: string,
  name: string,
): Promise<void> {
  return invoke("rename_mesocycle", { id, name });
}

export async function renameMicrocycle(
  id: string,
  name: string,
): Promise<void> {
  return invoke("rename_microcycle", { id, name });
}

export async function reorderBlocks(blockIds: string[]): Promise<void> {
  return invoke("reorder_blocks", { blockIds });
}

export async function reorderMesocycles(
  mesocycleIds: string[],
): Promise<void> {
  return invoke("reorder_mesocycles", { mesocycleIds });
}

export async function reorderMicrocycles(
  microcycleIds: string[],
): Promise<void> {
  return invoke("reorder_microcycles", { microcycleIds });
}

export async function duplicateMesocycle(
  mesocycleId: string,
): Promise<{ id: string }> {
  return invoke("duplicate_mesocycle", { mesocycleId });
}

// Exercise & Set commands (grid editing)
export async function saveMicrocycleExercises(
  microcycleId: string,
  exercises: import("../types").ProgramExerciseInput[],
): Promise<void> {
  return invoke("save_microcycle_exercises", { microcycleId, exercises });
}

// Training max commands
export async function getTrainingMaxes(
  programId: string,
): Promise<TrainingMax[]> {
  return invoke("get_training_maxes", { programId });
}

export async function setTrainingMax(
  programId: string,
  exerciseTemplateId: string,
  trainingMaxKg: number,
  estimated1rmKg?: number,
  source: string = "manual",
): Promise<TrainingMax> {
  return invoke("set_training_max", {
    programId,
    exerciseTemplateId,
    trainingMaxKg,
    estimated1rmKg: estimated1rmKg ?? null,
    source,
  });
}

export async function calculate1rmFromHistory(
  exerciseTemplateId: string,
): Promise<number> {
  return invoke("calculate_1rm_from_history", { exerciseTemplateId });
}

// Sync commands
export async function getSyncStatus(
  programId: string,
): Promise<SyncRecord | null> {
  return invoke("get_sync_status", { programId });
}

export async function previewSync(programId: string): Promise<{
  folder_name: string;
  routines_to_create: number;
  routines_to_update: number;
  routine_names: string[];
}> {
  return invoke("preview_sync", { programId });
}

export async function executeSync(programId: string): Promise<{
  success: boolean;
  created: number;
  updated: number;
  errors: string[];
}> {
  return invoke("execute_sync", { programId });
}
