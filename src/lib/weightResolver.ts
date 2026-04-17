import { resolvePercentageWeight } from "./formulas";
import { kgToLbs } from "./conversions";
import type { EquipmentCategory } from "../types/exercise";
import type { ResolvedTrainingMax, MinimumIncrements } from "../types";

export interface ResolvedWeight {
  weightKg: number;
  weightDisplay: string;
  tmScope: "program" | "global";
  trainingMaxKg: number;
}

/** Resolve a percentage-based set's actual weight, rounded to the nearest plate increment. */
export function resolveSetWeight(
  percentageOfTm: number,
  resolvedTm: ResolvedTrainingMax,
  equipment: EquipmentCategory | null,
  incrementsMap: MinimumIncrements,
  defaultIncrementKg: number,
  unitSystem: "metric" | "imperial",
): ResolvedWeight {
  const incrementKg =
    equipment && incrementsMap[equipment] != null
      ? incrementsMap[equipment]
      : defaultIncrementKg;

  const weightKg = resolvePercentageWeight(
    percentageOfTm,
    resolvedTm.training_max_kg,
    incrementKg,
  );

  let weightDisplay: string;
  if (unitSystem === "imperial") {
    const lbs = kgToLbs(weightKg);
    weightDisplay = `${lbs}lb`;
  } else {
    const kg = Math.round(weightKg * 10) / 10;
    weightDisplay = `${kg}kg`;
  }

  return {
    weightKg,
    weightDisplay,
    tmScope: resolvedTm.scope,
    trainingMaxKg: resolvedTm.training_max_kg,
  };
}
