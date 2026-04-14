import type {
  ProgramExercise,
  SetType,
  ProgramExerciseInput,
  ProgramSetInput,
} from "../../types";

/** Flat row representation for AG Grid. One row = one exercise. */
export interface GridRow {
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
}

/** Convert from backend ProgramExercise[] to GridRow[] */
export function exercisesToGridRows(exercises: ProgramExercise[]): GridRow[] {
  return exercises.map((ex, i) => ({
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
    })),
  }));
}

/** Convert from GridRow[] back to ProgramExerciseInput[] for saving */
export function gridRowsToExerciseInputs(
  rows: GridRow[],
): ProgramExerciseInput[] {
  return rows.map((row, i) => ({
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
        duration_seconds: null,
        distance_meters: null,
        custom_metric: null,
      }),
    ),
  }));
}

/** Format a set for compact display: "5x85%" or "8-12x70kg" or "10 @8" */
export function formatSet(
  s: GridSet,
  unitSystem: "metric" | "imperial",
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
    if (unitSystem === "imperial") {
      parts.push(`${Math.round(s.weightKg * 2.20462 * 10) / 10}lbs`);
    } else {
      parts.push(`${Math.round(s.weightKg * 10) / 10}kg`);
    }
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
    return `${repsPart} x ${rest.join(" ")}`;
  }
  return parts.join(" ");
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
          val = Math.round((val / 2.20462) * 10) / 10; // convert to kg
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
  };
}

/** Get the max number of sets across all rows */
export function getMaxSets(rows: GridRow[]): number {
  return Math.max(1, ...rows.map((r) => r.sets.length));
}
