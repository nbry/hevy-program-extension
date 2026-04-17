/** Epley formula: 1RM = weight * (1 + reps / 30) */
export function epley1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Brzycki formula: 1RM = weight * (36 / (37 - reps)) */
export function brzycki1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  if (reps >= 37) return 0;
  return weight * (36 / (37 - reps));
}

/** Returns the higher estimate from both formulas */
export function estimate1RM(weight: number, reps: number): number {
  return Math.max(epley1RM(weight, reps), brzycki1RM(weight, reps));
}

/** Calculate weight from training max and percentage */
export function weightFromPercentage(
  trainingMaxKg: number,
  percentage: number,
): number {
  return Math.round(trainingMaxKg * percentage * 100) / 100;
}

/** Round weight to nearest plate-friendly increment (2.5 kg / 5 lbs) */
export function roundToPlate(kg: number, increment: number = 2.5): number {
  if (increment <= 0) return kg;
  return Math.round(kg / increment) * increment;
}

/** Resolve the display weight for a percentage-based set.
 *  Returns the plate-rounded weight in kg. */
export function resolvePercentageWeight(
  percentageOfTm: number,
  trainingMaxKg: number,
  incrementKg: number,
): number {
  const rawKg = weightFromPercentage(trainingMaxKg, percentageOfTm);
  if (incrementKg <= 0) return rawKg;
  return roundToPlate(rawKg, incrementKg);
}
