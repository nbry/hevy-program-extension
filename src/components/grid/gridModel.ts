import type {
  ProgramExercise,
  SetType,
  ProgramExerciseInput,
  ProgramSetInput,
} from "../../types";
import type { ExerciseType } from "../../types/exercise";

let _rowCounter = 0;
export function nextRowId(): string {
  return `row_${++_rowCounter}_${Date.now()}`;
}

/** Flat row representation for AG Grid. One row = one exercise. */
export interface GridRow {
  id: string; // stable unique ID for AG Grid row tracking
  rowIndex: number;
  exerciseTemplateId: string;
  exerciseTitle: string;
  restSeconds: number | null;
  notes: string | null;
  sets: GridSet[];
}

export interface GridSet {
  setType: SetType;
  reps: number | null;
  repRangeStart: number | null;
  repRangeEnd: number | null;
  weightKg: number | null;
  percentageOfTm: number | null;
  rpeTarget: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
}

/** Convert from backend ProgramExercise[] to GridRow[] */
export function exercisesToGridRows(exercises: ProgramExercise[]): GridRow[] {
  return exercises.map((ex, i) => ({
    id: nextRowId(),
    rowIndex: i,
    exerciseTemplateId: ex.exercise_template_id,
    exerciseTitle: ex.exercise_title,
    restSeconds: ex.rest_seconds,
    notes: ex.notes,
    sets: ex.sets.map((s) => ({
      setType: s.set_type,
      reps: s.reps,
      repRangeStart: s.rep_range_start,
      repRangeEnd: s.rep_range_end,
      weightKg: s.weight_kg,
      percentageOfTm: s.percentage_of_tm,
      rpeTarget: s.rpe_target,
      durationSeconds: s.duration_seconds,
      distanceMeters: s.distance_meters,
    })),
  }));
}

/** Convert from GridRow[] back to ProgramExerciseInput[] for saving.
 *  Rows without a valid exerciseTemplateId are filtered out. */
export function gridRowsToExerciseInputs(
  rows: GridRow[],
): ProgramExerciseInput[] {
  return rows
    .filter((row) => row.exerciseTemplateId)
    .map((row, i) => ({
      exercise_template_id: row.exerciseTemplateId,
      sort_order: i,
      superset_group: null,
      rest_seconds: row.restSeconds,
      notes: row.notes,
      sets: row.sets.map(
        (s, si): ProgramSetInput => ({
          sort_order: si,
          set_type: s.setType,
          reps: s.reps,
          rep_range_start: s.repRangeStart,
          rep_range_end: s.repRangeEnd,
          weight_kg: s.weightKg,
          percentage_of_tm: s.percentageOfTm,
          rpe_target: s.rpeTarget,
          duration_seconds: s.durationSeconds,
          distance_meters: s.distanceMeters,
          custom_metric: null,
        }),
      ),
    }));
}

/** Format a set for compact display based on exercise type.
 *  weight_reps: "5 x 135lbs @8"
 *  duration: "60s"
 *  distance_duration: "5km / 25:00"
 *  weight_duration: "70kg x 60s"
 *  If resolvedWeightDisplay is provided, appends it after % sets: "5 x 85% (187lb)" */
export function formatSet(
  s: GridSet,
  unitSystem: "metric" | "imperial",
  resolvedWeightDisplay?: string,
  exerciseType?: ExerciseType,
): string {
  // Duration-only exercises (plank, etc.)
  if (exerciseType === "duration") {
    if (s.durationSeconds == null) return "";
    return formatDuration(s.durationSeconds);
  }

  // Distance + duration exercises (rowing, running, etc.)
  if (exerciseType === "distance_duration") {
    const parts: string[] = [];
    if (s.distanceMeters != null) parts.push(formatDistance(s.distanceMeters, unitSystem));
    if (s.durationSeconds != null) parts.push(formatDuration(s.durationSeconds));
    return parts.join(" / ") || "";
  }

  // Weight + duration exercises (farmer's carry, etc.)
  if (exerciseType === "weight_duration") {
    const parts: string[] = [];
    if (s.weightKg != null) {
      parts.push(formatWeightValue(s.weightKg, unitSystem));
    }
    if (s.durationSeconds != null) parts.push(formatDuration(s.durationSeconds));
    return parts.join(" x ") || "";
  }

  // Short distance + weight (sled push, etc.)
  if (exerciseType === "short_distance_weight") {
    const parts: string[] = [];
    if (s.distanceMeters != null) parts.push(formatDistance(s.distanceMeters, unitSystem));
    if (s.weightKg != null) parts.push(formatWeightValue(s.weightKg, unitSystem));
    return parts.join(" x ") || "";
  }

  // Reps-only / bodyweight exercises
  if (exerciseType === "reps_only" || exerciseType === "bodyweight_reps" || exerciseType === "bodyweight_assisted_reps") {
    const parts: string[] = [];
    if (s.repRangeStart != null && s.repRangeEnd != null) {
      parts.push(`${s.repRangeStart}-${s.repRangeEnd}`);
    } else if (s.reps != null) {
      parts.push(`${s.reps}`);
    }
    // Bodyweight-assisted can have weight (the assist weight)
    if (exerciseType === "bodyweight_assisted_reps" && s.weightKg != null) {
      parts.push(formatWeightValue(s.weightKg, unitSystem));
    }
    if (s.rpeTarget != null) parts.push(`@${s.rpeTarget}`);
    if (parts.length <= 1) return parts[0] ?? "";
    return parts.join(" x ");
  }

  // Default: weight_reps (original logic)
  return formatWeightRepsSet(s, unitSystem, resolvedWeightDisplay);
}

function formatWeightRepsSet(
  s: GridSet,
  unitSystem: "metric" | "imperial",
  resolvedWeightDisplay?: string,
): string {
  const parts: string[] = [];

  // Reps part
  if (s.repRangeStart != null && s.repRangeEnd != null) {
    parts.push(`${s.repRangeStart}-${s.repRangeEnd}`);
  } else if (s.reps != null) {
    parts.push(`${s.reps}`);
  }

  // Weight part
  if (s.percentageOfTm != null) {
    parts.push(`${Math.round(s.percentageOfTm * 100)}%`);
  } else if (s.weightKg != null) {
    parts.push(formatWeightValue(s.weightKg, unitSystem));
  }

  // RPE part
  if (s.rpeTarget != null) {
    parts.push(`@${s.rpeTarget}`);
  }

  if (parts.length === 0) return "";

  // Join: reps x weight @rpe
  const repsPart = parts[0];
  const rest = parts.slice(1);
  if (s.percentageOfTm != null || s.weightKg != null) {
    let result = `${repsPart} x ${rest.join(" ")}`;
    if (resolvedWeightDisplay && s.percentageOfTm != null) {
      result += ` (${resolvedWeightDisplay})`;
    }
    return result;
  }
  return parts.join(" ");
}

function formatWeightValue(kg: number, unitSystem: "metric" | "imperial"): string {
  if (unitSystem === "imperial") {
    const lbs = Math.round(kg * 2.20462);
    return `${lbs}lbs`;
  }
  const rounded = Math.round(kg * 10) / 10;
  return `${rounded}kg`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (sec === 0) return `${min}:00`;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function formatDistance(meters: number, unitSystem: "metric" | "imperial"): string {
  if (unitSystem === "imperial") {
    const miles = meters / 1609.344;
    if (miles >= 0.1) return `${Math.round(miles * 100) / 100}mi`;
    const yards = meters * 1.09361;
    return `${Math.round(yards)}yd`;
  }
  if (meters >= 1000) return `${Math.round(meters / 100) / 10}km`;
  return `${Math.round(meters)}m`;
}

/** Parse a compact set string back into a GridSet */
export function parseSetString(
  input: string,
  unitSystem: "metric" | "imperial",
): GridSet | null {
  const s = input.trim();
  if (!s) return null;

  const result: GridSet = {
    setType: "normal",
    reps: null,
    repRangeStart: null,
    repRangeEnd: null,
    weightKg: null,
    percentageOfTm: null,
    rpeTarget: null,
    durationSeconds: null,
    distanceMeters: null,
  };

  // Extract RPE: @8, @9.5
  const rpeMatch = s.match(/@(\d+\.?\d*)/);
  if (rpeMatch) {
    result.rpeTarget = parseFloat(rpeMatch[1]);
  }

  // Remove RPE part for further parsing
  const withoutRpe = s.replace(/@\d+\.?\d*/, "").trim();

  // Split by 'x' or 'X'
  const xParts = withoutRpe.split(/\s*[xX]\s*/);

  // First part: reps or rep range
  const repPart = xParts[0]?.trim();
  if (repPart) {
    const rangeMatch = repPart.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      result.repRangeStart = parseInt(rangeMatch[1]);
      result.repRangeEnd = parseInt(rangeMatch[2]);
    } else {
      const n = parseInt(repPart);
      if (!isNaN(n)) result.reps = n;
    }
  }

  // Second part: weight (percentage or absolute)
  const weightPart = xParts[1]?.trim();
  if (weightPart) {
    if (weightPart.endsWith("%")) {
      const pct = parseFloat(weightPart);
      if (!isNaN(pct)) result.percentageOfTm = pct / 100;
    } else {
      const numMatch = weightPart.match(/^([\d.]+)/);
      if (numMatch) {
        let val = parseFloat(numMatch[1]);
        if (
          weightPart.toLowerCase().includes("lbs") ||
          (unitSystem === "imperial" &&
            !weightPart.toLowerCase().includes("kg"))
        ) {
          val = Math.round((val / 2.20462) * 10000) / 10000; // convert to kg
        }
        result.weightKg = val;
      }
    }
  }

  return result;
}

/** Create a default empty set */
export function defaultSet(): GridSet {
  return {
    setType: "normal",
    reps: null,
    repRangeStart: null,
    repRangeEnd: null,
    weightKg: null,
    percentageOfTm: null,
    rpeTarget: null,
    durationSeconds: null,
    distanceMeters: null,
  };
}

/** Get the max number of sets across all rows */
export function getMaxSets(rows: GridRow[]): number {
  return Math.max(1, ...rows.map((r) => r.sets.length));
}
