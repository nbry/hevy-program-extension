import { invoke } from "@tauri-apps/api/core";
import type {
  ExerciseTemplate,
  UserSettings,
  Program,
  ProgramFull,
  TrainingMax,
  GlobalTrainingMax,
  SyncRecord,
  MinimumIncrements,
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
  const raw = await invoke<Record<string, unknown>>("get_settings");
  // Parse minimum_increments_kg from JSON string to object
  let minimumIncrements: MinimumIncrements;
  try {
    minimumIncrements =
      typeof raw.minimum_increments_kg === "string"
        ? JSON.parse(raw.minimum_increments_kg)
        : raw.minimum_increments_kg;
  } catch {
    minimumIncrements = {
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
  }
  return { ...raw, minimum_increments_kg: minimumIncrements } as UserSettings;
}

export async function updateSettings(
  settings: Partial<UserSettings>,
): Promise<void> {
  // Serialize minimum_increments_kg to JSON string for backend
  const payload: Record<string, unknown> = { ...settings };
  if (settings.minimum_increments_kg) {
    payload.minimum_increments_kg = JSON.stringify(
      settings.minimum_increments_kg,
    );
  }
  return invoke("update_settings", { settings: payload });
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

export async function renameMesocycle(id: string, name: string): Promise<void> {
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

export async function reorderMesocycles(mesocycleIds: string[]): Promise<void> {
  return invoke("reorder_mesocycles", { mesocycleIds });
}

export async function reorderMicrocycles(
  microcycleIds: string[],
): Promise<void> {
  return invoke("reorder_microcycles", { microcycleIds });
}

export async function moveMicrocycle(
  microcycleId: string,
  targetMesocycleId: string,
): Promise<void> {
  return invoke("move_microcycle", { microcycleId, targetMesocycleId });
}

export async function setMesocycleMirror(
  mesocycleId: string,
  mirrorOf: string | null,
): Promise<void> {
  return invoke("set_mesocycle_mirror", { mesocycleId, mirrorOf });
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

export async function deleteTrainingMax(
  programId: string,
  exerciseTemplateId: string,
): Promise<void> {
  return invoke("delete_training_max", { programId, exerciseTemplateId });
}

// Global training max commands
export async function getGlobalTrainingMaxes(): Promise<GlobalTrainingMax[]> {
  return invoke("get_global_training_maxes");
}

export async function setGlobalTrainingMax(
  exerciseTemplateId: string,
  trainingMaxKg: number,
  estimated1rmKg?: number,
  source: string = "manual",
): Promise<GlobalTrainingMax> {
  return invoke("set_global_training_max", {
    exerciseTemplateId,
    trainingMaxKg,
    estimated1rmKg: estimated1rmKg ?? null,
    source,
  });
}

export async function deleteGlobalTrainingMax(
  exerciseTemplateId: string,
): Promise<void> {
  return invoke("delete_global_training_max", { exerciseTemplateId });
}

// Exercise equipment
export async function updateExerciseEquipment(
  exerciseTemplateId: string,
  equipment: string | null,
): Promise<void> {
  return invoke("update_exercise_equipment", { exerciseTemplateId, equipment });
}

export async function calculate1rmFromHistory(
  exerciseTemplateId: string,
): Promise<number> {
  return invoke("calculate_1rm_from_history", { exerciseTemplateId });
}

// Sync commands
export interface SyncPreviewRoutine {
  microcycle_id: string;
  name: string;
  is_update: boolean;
  hevy_routine_id: string | null;
}

export interface OrphanedRoutine {
  hevy_routine_id: string;
  name: string;
}

export interface SyncPreview {
  folder_name: string;
  routines: SyncPreviewRoutine[];
  orphaned_routines: OrphanedRoutine[];
  total_create: number;
  total_update: number;
}

export interface SyncResultData {
  success: boolean;
  created: number;
  updated: number;
  orphans_renamed: number;
  errors: string[];
}

export async function getSyncStatus(
  programId: string,
): Promise<SyncRecord | null> {
  return invoke("get_sync_status", { programId });
}

export async function previewSync(programId: string): Promise<SyncPreview> {
  return invoke("preview_sync", { programId });
}

export async function executeSync(
  programId: string,
  renameOrphans: boolean,
): Promise<SyncResultData> {
  return invoke("execute_sync", { programId, renameOrphans });
}

// Import from Hevy commands
export interface HevyFolderInfo {
  id: number;
  title: string;
  routine_count: number;
  already_linked: boolean;
  linked_program_name: string | null;
}

export interface ImportPreviewRoutine {
  hevy_routine_id: string;
  title: string;
  exercise_count: number;
  set_count: number;
  parsed_week: number | null;
  parsed_day: number | null;
  parsed_name: string | null;
}

export interface ImportWeek {
  week_number: number;
  days: ImportDay[];
}

export interface ImportDay {
  day_number: number;
  routine_title: string;
  hevy_routine_id: string;
  exercise_count: number;
  set_count: number;
}

export interface ImportPreview {
  folder_name: string;
  folder_id: number;
  routines: ImportPreviewRoutine[];
  weeks: ImportWeek[];
}

export interface ImportResult {
  success: boolean;
  program_id: string;
  program_name: string;
  microcycles_created: number;
  exercises_imported: number;
  errors: string[];
}

export async function listHevyFolders(): Promise<HevyFolderInfo[]> {
  return invoke("list_hevy_folders");
}

export async function previewImport(folderId: number): Promise<ImportPreview> {
  return invoke("preview_import", { folderId });
}

export async function executeImport(
  folderId: number,
  programName: string,
  targetProgramId: string | null,
  targetMode: "new_program" | "new_block",
): Promise<ImportResult> {
  return invoke("execute_import", {
    folderId,
    programName,
    targetProgramId,
    targetMode,
  });
}

// Pull from Hevy commands
export interface PullChange {
  microcycle_id: string;
  microcycle_name: string;
  hevy_routine_id: string;
  local_exercise_count: number;
  remote_exercise_count: number;
  local_set_count: number;
  remote_set_count: number;
  has_changes: boolean;
}

export interface PullPreview {
  changes: PullChange[];
  unchanged: string[];
}

export interface PullResult {
  success: boolean;
  updated_microcycles: number;
  errors: string[];
}

export async function previewPull(programId: string): Promise<PullPreview> {
  return invoke("preview_pull", { programId });
}

export async function executePull(
  programId: string,
  microcycleIds: string[],
): Promise<PullResult> {
  return invoke("execute_pull", { programId, microcycleIds });
}
