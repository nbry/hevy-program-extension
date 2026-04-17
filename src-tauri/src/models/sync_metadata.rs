use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncRecord {
    pub id: String,
    pub program_id: String,
    pub hevy_folder_id: Option<i64>,
    pub hevy_folder_title: Option<String>,
    pub last_synced_at: Option<String>,
    pub sync_status: String,
    pub sync_mode: String,
    pub sync_direction: String,
    pub block_id: Option<String>,
}
