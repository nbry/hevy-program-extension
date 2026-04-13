use crate::hevy::client::HevyClient;
use crate::models::exercise::ExerciseTemplate;
use crate::AppState;
use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct SyncResult {
    pub added: i32,
    pub updated: i32,
}

fn get_api_key_from_keyring() -> Result<String, String> {
    let entry = keyring::Entry::new("hevy-program-extension", "api-key")
        .map_err(|e| format!("Keyring error: {}", e))?;
    entry
        .get_password()
        .map_err(|_| "No API key configured. Please add your key in Settings.".to_string())
}

#[tauri::command]
pub async fn sync_exercise_templates(
    state: State<'_, Mutex<AppState>>,
) -> Result<SyncResult, String> {
    let api_key = get_api_key_from_keyring()?;
    let client = HevyClient::new(api_key);

    let mut all_templates = Vec::new();
    let mut page = 1;

    loop {
        let resp = client.get_exercise_templates(page, 100).await?;
        all_templates.extend(resp.exercise_templates);
        if page >= resp.page_count {
            break;
        }
        page += 1;
    }

    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let mut added = 0;
    let mut updated = 0;

    for template in &all_templates {
        let secondary = serde_json::to_string(&template.secondary_muscle_groups)
            .unwrap_or_else(|_| "[]".to_string());

        let exists: bool = app_state
            .db
            .query_row(
                "SELECT COUNT(*) > 0 FROM exercise_templates WHERE id = ?1",
                rusqlite::params![template.id],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if exists {
            app_state.db.execute(
                "UPDATE exercise_templates SET title = ?1, exercise_type = ?2, primary_muscle_group = ?3, secondary_muscle_groups = ?4, is_custom = ?5, cached_at = datetime('now') WHERE id = ?6",
                rusqlite::params![
                    template.title,
                    template.exercise_type,
                    template.primary_muscle_group,
                    secondary,
                    template.is_custom as i32,
                    template.id,
                ],
            ).map_err(|e| format!("DB error: {}", e))?;
            updated += 1;
        } else {
            app_state.db.execute(
                "INSERT INTO exercise_templates (id, title, exercise_type, primary_muscle_group, secondary_muscle_groups, is_custom, cached_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))",
                rusqlite::params![
                    template.id,
                    template.title,
                    template.exercise_type,
                    template.primary_muscle_group,
                    secondary,
                    template.is_custom as i32,
                ],
            ).map_err(|e| format!("DB error: {}", e))?;
            added += 1;
        }
    }

    // Update cache timestamp
    app_state.db.execute(
        "UPDATE settings SET exercise_cache_updated_at = datetime('now'), updated_at = datetime('now') WHERE id = 1",
        [],
    ).map_err(|e| format!("DB error: {}", e))?;

    log::info!(
        "Synced {} exercise templates ({} added, {} updated)",
        all_templates.len(),
        added,
        updated
    );

    Ok(SyncResult { added, updated })
}

#[tauri::command]
pub async fn get_exercise_templates(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<ExerciseTemplate>, String> {
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let mut stmt = app_state
        .db
        .prepare("SELECT id, title, exercise_type, primary_muscle_group, secondary_muscle_groups, equipment, is_custom FROM exercise_templates ORDER BY title")
        .map_err(|e| format!("DB error: {}", e))?;

    let templates = stmt
        .query_map([], |row| {
            let secondary_json: String = row.get::<_, String>(4).unwrap_or_else(|_| "[]".to_string());
            let secondary: Vec<String> =
                serde_json::from_str(&secondary_json).unwrap_or_default();

            Ok(ExerciseTemplate {
                id: row.get(0)?,
                title: row.get(1)?,
                exercise_type: row.get(2)?,
                primary_muscle_group: row.get(3)?,
                secondary_muscle_groups: secondary,
                equipment: row.get(5)?,
                is_custom: row.get::<_, i32>(6)? != 0,
            })
        })
        .map_err(|e| format!("DB error: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("DB error: {}", e))?;

    Ok(templates)
}

#[tauri::command]
pub async fn search_exercises(
    state: State<'_, Mutex<AppState>>,
    query: String,
    limit: i32,
) -> Result<Vec<ExerciseTemplate>, String> {
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let pattern = format!("%{}%", query);

    let mut stmt = app_state
        .db
        .prepare("SELECT id, title, exercise_type, primary_muscle_group, secondary_muscle_groups, equipment, is_custom FROM exercise_templates WHERE title LIKE ?1 ORDER BY title LIMIT ?2")
        .map_err(|e| format!("DB error: {}", e))?;

    let templates = stmt
        .query_map(rusqlite::params![pattern, limit], |row| {
            let secondary_json: String = row.get::<_, String>(4).unwrap_or_else(|_| "[]".to_string());
            let secondary: Vec<String> =
                serde_json::from_str(&secondary_json).unwrap_or_default();

            Ok(ExerciseTemplate {
                id: row.get(0)?,
                title: row.get(1)?,
                exercise_type: row.get(2)?,
                primary_muscle_group: row.get(3)?,
                secondary_muscle_groups: secondary,
                equipment: row.get(5)?,
                is_custom: row.get::<_, i32>(6)? != 0,
            })
        })
        .map_err(|e| format!("DB error: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("DB error: {}", e))?;

    Ok(templates)
}

#[tauri::command]
pub async fn calculate_1rm_from_history(
    exercise_template_id: String,
) -> Result<f64, String> {
    let api_key = get_api_key_from_keyring()?;
    let client = HevyClient::new(api_key);

    let history = client
        .get_exercise_history(&exercise_template_id, None, None)
        .await?;

    let mut best_e1rm: f64 = 0.0;
    for entry in &history {
        if entry.set_type == "warmup" {
            continue;
        }
        if let (Some(weight), Some(reps)) = (entry.weight_kg, entry.reps) {
            if weight > 0.0 && reps > 0 {
                let e1rm = if reps == 1 {
                    weight
                } else {
                    // Epley formula
                    let epley = weight * (1.0 + reps as f64 / 30.0);
                    // Brzycki formula
                    let brzycki = if reps < 37 {
                        weight * (36.0 / (37.0 - reps as f64))
                    } else {
                        0.0
                    };
                    epley.max(brzycki)
                };
                if e1rm > best_e1rm {
                    best_e1rm = e1rm;
                }
            }
        }
    }

    if best_e1rm <= 0.0 {
        return Err("No valid workout data found to estimate 1RM".to_string());
    }

    Ok((best_e1rm * 10.0).round() / 10.0) // Round to 1 decimal
}
