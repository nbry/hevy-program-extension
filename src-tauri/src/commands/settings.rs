use crate::models::settings::UserSettings;
use crate::AppState;
use serde::Deserialize;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Deserialize)]
pub struct SettingsUpdate {
    pub unit_system: Option<String>,
}

#[tauri::command]
pub async fn get_settings(
    state: State<'_, Mutex<AppState>>,
) -> Result<UserSettings, String> {
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let settings = app_state
        .db
        .query_row(
            "SELECT unit_system, hevy_user_id, hevy_username, exercise_cache_updated_at FROM settings WHERE id = 1",
            [],
            |row| {
                Ok(UserSettings {
                    unit_system: row.get(0)?,
                    hevy_user_id: row.get(1)?,
                    hevy_username: row.get(2)?,
                    exercise_cache_updated_at: row.get(3)?,
                    api_key_configured: false, // will be set below
                })
            },
        )
        .map_err(|e| format!("DB error: {}", e))?;

    // Check if API key exists in keyring
    let api_key_configured = keyring::Entry::new("hevy-program-extension", "api-key")
        .ok()
        .and_then(|entry| entry.get_password().ok())
        .is_some();

    Ok(UserSettings {
        api_key_configured,
        ..settings
    })
}

#[tauri::command]
pub async fn update_settings(
    state: State<'_, Mutex<AppState>>,
    settings: SettingsUpdate,
) -> Result<(), String> {
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    if let Some(unit_system) = &settings.unit_system {
        app_state
            .db
            .execute(
                "UPDATE settings SET unit_system = ?1, updated_at = datetime('now') WHERE id = 1",
                rusqlite::params![unit_system],
            )
            .map_err(|e| format!("DB error: {}", e))?;
    }

    Ok(())
}
