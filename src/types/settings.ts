import type { EquipmentCategory } from "./exercise";

export type UnitSystem = "metric" | "imperial";

export type MinimumIncrements = Record<EquipmentCategory, number>;

export interface UserSettings {
  unit_system: UnitSystem;
  hevy_user_id: string | null;
  hevy_username: string | null;
  exercise_cache_updated_at: string | null;
  api_key_configured: boolean;
  zoom_level: number;
  minimum_increments_kg: MinimumIncrements;
  default_increment_kg: number;
}
