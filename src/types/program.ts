// TypeScript types for the program data model

export interface Program {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Block {
  id: string;
  program_id: string;
  name: string;
  sort_order: number;
  mesocycles: Mesocycle[];
  created_at: string;
  updated_at: string;
}

export interface Mesocycle {
  id: string;
  block_id: string;
  name: string;
  week_number: number;
  sort_order: number;
  mirror_of: string | null;
  microcycles: Microcycle[];
  created_at: string;
  updated_at: string;
}

export interface Microcycle {
  id: string;
  mesocycle_id: string;
  name: string;
  day_number: number;
  notes: string | null;
  sort_order: number;
  exercises: ProgramExercise[];
  created_at: string;
  updated_at: string;
}

export interface ProgramExercise {
  id: string;
  microcycle_id: string;
  exercise_template_id: string;
  exercise_title: string; // denormalized for display
  sort_order: number;
  superset_group: number | null;
  rest_seconds: number | null;
  notes: string | null;
  sets: ProgramSet[];
}

export interface ProgramSet {
  id: string;
  program_exercise_id: string;
  sort_order: number;
  set_type: SetType;
  reps: number | null;
  rep_range_start: number | null;
  rep_range_end: number | null;
  weight_kg: number | null;
  percentage_of_tm: number | null;
  rpe_target: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  custom_metric: number | null;
}

export type SetType = "warmup" | "normal" | "failure" | "dropset";

export interface ProgramFull extends Program {
  blocks: Block[];
}

export interface ProgramExerciseInput {
  exercise_template_id: string;
  sort_order: number;
  superset_group: number | null;
  rest_seconds: number | null;
  notes: string | null;
  sets: ProgramSetInput[];
}

export interface ProgramSetInput {
  sort_order: number;
  set_type: SetType;
  reps: number | null;
  rep_range_start: number | null;
  rep_range_end: number | null;
  weight_kg: number | null;
  percentage_of_tm: number | null;
  rpe_target: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  custom_metric: number | null;
}

export interface TrainingMax {
  id: string;
  exercise_template_id: string;
  program_id: string;
  estimated_1rm_kg: number | null;
  training_max_kg: number;
  tm_percentage_of_1rm: number;
  source: TrainingMaxSource;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GlobalTrainingMax {
  id: string;
  exercise_template_id: string;
  estimated_1rm_kg: number | null;
  training_max_kg: number;
  tm_percentage_of_1rm: number;
  source: TrainingMaxSource;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type TrainingMaxSource = "manual" | "hevy_import" | "calculated";

export interface ResolvedTrainingMax {
  training_max_kg: number;
  source: TrainingMaxSource;
  scope: "program" | "global";
  estimated_1rm_kg: number | null;
}

export interface SyncRecord {
  id: string;
  program_id: string;
  hevy_folder_id: number | null;
  hevy_folder_title: string | null;
  last_synced_at: string | null;
  sync_status: "never" | "synced" | "modified" | "error";
  sync_mode: "program" | "block";
  sync_direction: "push" | "pull";
  block_id: string | null;
}
