import type { EquipmentCategory } from "../types/exercise";

const EQUIPMENT_PATTERNS: Array<[RegExp, EquipmentCategory]> = [
  [/\(barbell\)/i, "barbell"],
  [/\(dumbbell\)/i, "dumbbell"],
  [/\(cable\)/i, "machine"],
  [/\(machine\)/i, "machine"],
  [/\(smith machine\)/i, "machine"],
  [/\(lever\)/i, "machine"],
  [/\(kettlebell\)/i, "kettlebell"],
  [/\(band\)/i, "resistance_band"],
  [/\(resistance band\)/i, "resistance_band"],
  [/\(bodyweight\)/i, "none"],
  [/\(assisted\)/i, "none"],
  [/\(self-assisted\)/i, "none"],
  [/\(plate\)/i, "plate"],
  [/\(weighted\)/i, "plate"],
  [/\(suspension\)/i, "suspension"],
  [/\(trx\)/i, "suspension"],
];

/** Guess equipment category from exercise title patterns. */
export function guessEquipment(title: string): EquipmentCategory | null {
  for (const [pattern, equipment] of EQUIPMENT_PATTERNS) {
    if (pattern.test(title)) return equipment;
  }
  return null;
}
