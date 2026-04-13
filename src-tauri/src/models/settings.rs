use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct UserSettings {
    pub unit_system: String,
    pub hevy_user_id: Option<String>,
    pub hevy_username: Option<String>,
    pub exercise_cache_updated_at: Option<String>,
    pub api_key_configured: bool,
}
