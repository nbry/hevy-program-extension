export type UnitSystem = "metric" | "imperial";

export interface UserSettings {
  unit_system: UnitSystem;
  hevy_user_id: string | null;
  hevy_username: string | null;
  exercise_cache_updated_at: string | null;
  api_key_configured: boolean;
}
