use crate::hevy::client::HevyClient;
use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

use crate::AppState;

const SERVICE_NAME: &str = "hevy-program-extension";
const KEY_USER: &str = "api-key";

#[derive(Debug, Serialize)]
pub struct UserInfoResult {
    pub id: String,
    pub name: String,
    pub url: String,
}

#[tauri::command]
pub async fn validate_api_key(key: String) -> Result<UserInfoResult, String> {
    let client = HevyClient::new(key);
    let info = client.validate_key().await?;
    Ok(UserInfoResult {
        id: info.id,
        name: info.name,
        url: info.url,
    })
}

#[tauri::command]
pub async fn store_api_key(
    key: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    // Validate first
    let client = HevyClient::new(key.clone());
    let info = client.validate_key().await?;

    // Store in keyring
    let entry = keyring::Entry::new(SERVICE_NAME, KEY_USER)
        .map_err(|e| format!("Failed to access keyring: {}", e))?;
    entry
        .set_password(&key)
        .map_err(|e| format!("Failed to store key: {}", e))?;

    // Update settings in DB
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    app_state.db.execute(
        "UPDATE settings SET hevy_user_id = ?1, hevy_username = ?2, updated_at = datetime('now') WHERE id = 1",
        rusqlite::params![info.id, info.name],
    ).map_err(|e| format!("DB error: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_api_key() -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(SERVICE_NAME, KEY_USER)
        .map_err(|e| format!("Failed to access keyring: {}", e))?;

    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to get key: {}", e)),
    }
}

#[tauri::command]
pub async fn remove_api_key(
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE_NAME, KEY_USER)
        .map_err(|e| format!("Failed to access keyring: {}", e))?;

    match entry.delete_credential() {
        Ok(()) => {}
        Err(keyring::Error::NoEntry) => {}
        Err(e) => return Err(format!("Failed to delete key: {}", e)),
    }

    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    app_state.db.execute(
        "UPDATE settings SET hevy_user_id = NULL, hevy_username = NULL, updated_at = datetime('now') WHERE id = 1",
        [],
    ).map_err(|e| format!("DB error: {}", e))?;

    Ok(())
}
