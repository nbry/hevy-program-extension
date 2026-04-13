export const KG_TO_LBS = 2.20462;
export const LBS_TO_KG = 1 / KG_TO_LBS;

export function kgToLbs(kg: number): number {
  return Math.round(kg * KG_TO_LBS * 10) / 10;
}

export function lbsToKg(lbs: number): number {
  return Math.round(lbs * LBS_TO_KG * 10) / 10;
}

export function formatWeight(kg: number, unit: "metric" | "imperial"): string {
  if (unit === "imperial") {
    return `${kgToLbs(kg)} lbs`;
  }
  return `${Math.round(kg * 10) / 10} kg`;
}

export function parseWeightToKg(
  value: number,
  unit: "metric" | "imperial",
): number {
  if (unit === "imperial") {
    return lbsToKg(value);
  }
  return value;
}
