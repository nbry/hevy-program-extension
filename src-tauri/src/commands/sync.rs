use crate::hevy::client::{
    CreateRoutineBody, HevyClient, RepRange, RoutineExercise, RoutineSet,
    RoutineDetailResponse, RoutineExerciseResponse,
};
use crate::models::sync_metadata::SyncRecord;
use crate::AppState;
use regex::Regex;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

// --- Response types ---

#[derive(Debug, Serialize)]
pub struct SyncPreviewRoutine {
    pub microcycle_id: String,
    pub name: String,
    pub is_update: bool,
    pub hevy_routine_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct OrphanedRoutine {
    pub hevy_routine_id: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct SyncPreview {
    pub folder_name: String,
    pub routines: Vec<SyncPreviewRoutine>,
    pub orphaned_routines: Vec<OrphanedRoutine>,
    pub total_create: usize,
    pub total_update: usize,
}

#[derive(Debug, Serialize)]
pub struct SyncResult {
    pub success: bool,
    pub created: usize,
    pub updated: usize,
    pub orphans_renamed: usize,
    pub errors: Vec<String>,
}

// --- Weight resolution helpers ---

fn weight_from_percentage(percentage: f64, training_max_kg: f64) -> f64 {
    (training_max_kg * percentage * 100.0).round() / 100.0
}

fn round_to_plate(weight_kg: f64, increment_kg: f64) -> f64 {
    if increment_kg <= 0.0 {
        return weight_kg;
    }
    (weight_kg / increment_kg).round() * increment_kg
}

fn resolve_percentage_weight(
    percentage_of_tm: f64,
    training_max_kg: f64,
    increment_kg: f64,
) -> f64 {
    let raw = weight_from_percentage(percentage_of_tm, training_max_kg);
    if increment_kg <= 0.0 {
        return raw;
    }
    round_to_plate(raw, increment_kg)
}

// --- Helpers for querying DB ---

struct MicrocycleInfo {
    id: String,
    name: String,
    day_number: i32,
    week_number: i32,
}

struct ExerciseInfo {
    exercise_template_id: String,
    sort_order: i32,
    superset_group: Option<i32>,
    rest_seconds: Option<i32>,
    notes: Option<String>,
    sets: Vec<SetInfo>,
}

struct SetInfo {
    set_type: String,
    reps: Option<i32>,
    rep_range_start: Option<i32>,
    rep_range_end: Option<i32>,
    weight_kg: Option<f64>,
    percentage_of_tm: Option<f64>,
    duration_seconds: Option<i32>,
    distance_meters: Option<i32>,
    custom_metric: Option<f64>,
}

fn build_routine_name(micro: &MicrocycleInfo) -> String {
    let prefix = format!("W{}D{}", micro.week_number, micro.day_number);
    if micro.name.is_empty()
        || micro.name == format!("Day {}", micro.day_number)
    {
        prefix
    } else {
        format!("{} - {}", prefix, micro.name)
    }
}

fn collect_microcycles(
    db: &rusqlite::Connection,
    program_id: &str,
) -> Result<Vec<MicrocycleInfo>, String> {
    let mut stmt = db
        .prepare(
            "SELECT mi.id, mi.name, mi.day_number, me.week_number
             FROM microcycles mi
             JOIN mesocycles me ON me.id = mi.mesocycle_id
             JOIN blocks b ON b.id = me.block_id
             WHERE b.program_id = ?1
             ORDER BY b.sort_order, me.sort_order, mi.sort_order",
        )
        .map_err(|e| format!("DB error: {}", e))?;

    let rows = stmt
        .query_map(rusqlite::params![program_id], |row| {
            Ok(MicrocycleInfo {
                id: row.get(0)?,
                name: row.get(1)?,
                day_number: row.get(2)?,
                week_number: row.get(3)?,
            })
        })
        .map_err(|e| format!("DB error: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("DB error: {}", e))?;

    Ok(rows)
}

fn load_exercises_for_microcycle(
    db: &rusqlite::Connection,
    microcycle_id: &str,
) -> Result<Vec<ExerciseInfo>, String> {
    let mut ex_stmt = db
        .prepare(
            "SELECT pe.exercise_template_id, pe.sort_order, pe.superset_group, pe.rest_seconds, pe.notes, pe.id
             FROM program_exercises pe
             WHERE pe.microcycle_id = ?1
             ORDER BY pe.sort_order",
        )
        .map_err(|e| format!("DB error: {}", e))?;

    let ex_rows: Vec<(String, i32, Option<i32>, Option<i32>, Option<String>, String)> = ex_stmt
        .query_map(rusqlite::params![microcycle_id], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
            ))
        })
        .map_err(|e| format!("DB error: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("DB error: {}", e))?;

    let mut exercises = Vec::new();
    for (template_id, sort_order, superset_group, rest_seconds, notes, ex_id) in ex_rows {
        let mut set_stmt = db
            .prepare(
                "SELECT set_type, reps, rep_range_start, rep_range_end, weight_kg, percentage_of_tm, duration_seconds, distance_meters, custom_metric
                 FROM program_sets WHERE program_exercise_id = ?1 ORDER BY sort_order",
            )
            .map_err(|e| format!("DB error: {}", e))?;

        let sets: Vec<SetInfo> = set_stmt
            .query_map(rusqlite::params![ex_id], |row| {
                Ok(SetInfo {
                    set_type: row.get(0)?,
                    reps: row.get(1)?,
                    rep_range_start: row.get(2)?,
                    rep_range_end: row.get(3)?,
                    weight_kg: row.get(4)?,
                    percentage_of_tm: row.get(5)?,
                    duration_seconds: row.get(6)?,
                    distance_meters: row.get(7)?,
                    custom_metric: row.get(8)?,
                })
            })
            .map_err(|e| format!("DB error: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("DB error: {}", e))?;

        exercises.push(ExerciseInfo {
            exercise_template_id: template_id,
            sort_order,
            superset_group,
            rest_seconds,
            notes,
            sets,
        });
    }

    Ok(exercises)
}

/// Look up the training max for a given exercise: program-scoped first, then global.
fn resolve_training_max_kg(
    db: &rusqlite::Connection,
    program_id: &str,
    exercise_template_id: &str,
) -> Option<f64> {
    // Program-scoped TM first
    if let Ok(tm) = db.query_row(
        "SELECT training_max_kg FROM training_maxes WHERE program_id = ?1 AND exercise_template_id = ?2",
        rusqlite::params![program_id, exercise_template_id],
        |row| row.get::<_, f64>(0),
    ) {
        return Some(tm);
    }
    // Global TM fallback
    db.query_row(
        "SELECT training_max_kg FROM global_training_maxes WHERE exercise_template_id = ?1",
        rusqlite::params![exercise_template_id],
        |row| row.get::<_, f64>(0),
    )
    .ok()
}

/// Get the increment for an exercise's equipment type.
fn get_increment_for_exercise(
    db: &rusqlite::Connection,
    exercise_template_id: &str,
) -> f64 {
    // Get equipment type
    let equipment: Option<String> = db
        .query_row(
            "SELECT equipment FROM exercise_templates WHERE id = ?1",
            rusqlite::params![exercise_template_id],
            |row| row.get(0),
        )
        .ok()
        .flatten();

    // Get increments map and default
    let (increments_json, default_increment): (String, f64) = db
        .query_row(
            "SELECT minimum_increments_kg, default_increment_kg FROM settings WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap_or_else(|_| {
            (
                r#"{"barbell":2.5,"dumbbell":2.0,"machine":5.0,"kettlebell":4.0,"plate":2.5,"other":2.5,"none":0,"resistance_band":0,"suspension":0}"#.to_string(),
                2.5,
            )
        });

    if let Some(eq) = equipment {
        if let Ok(map) = serde_json::from_str::<HashMap<String, f64>>(&increments_json) {
            if let Some(&inc) = map.get(&eq) {
                return inc;
            }
        }
    }

    default_increment
}

fn build_routine_body(
    db: &rusqlite::Connection,
    program_id: &str,
    micro: &MicrocycleInfo,
    folder_id: Option<i64>,
) -> Result<CreateRoutineBody, String> {
    let exercises = load_exercises_for_microcycle(db, &micro.id)?;

    let routine_exercises: Vec<RoutineExercise> = exercises
        .iter()
        .map(|ex| {
            let sets: Vec<RoutineSet> = ex
                .sets
                .iter()
                .map(|s| {
                    let mut weight_kg = s.weight_kg;

                    // Resolve %TM to actual weight
                    if let Some(pct) = s.percentage_of_tm {
                        if let Some(tm_kg) =
                            resolve_training_max_kg(db, program_id, &ex.exercise_template_id)
                        {
                            let increment =
                                get_increment_for_exercise(db, &ex.exercise_template_id);
                            weight_kg = Some(resolve_percentage_weight(pct, tm_kg, increment));
                        }
                    }

                    let rep_range = match (s.rep_range_start, s.rep_range_end) {
                        (Some(start), Some(end)) => Some(RepRange { start, end }),
                        _ => None,
                    };

                    RoutineSet {
                        set_type: s.set_type.clone(),
                        weight_kg,
                        reps: s.reps,
                        rep_range,
                        distance_meters: s.distance_meters,
                        duration_seconds: s.duration_seconds,
                        custom_metric: s.custom_metric,
                    }
                })
                .collect();

            RoutineExercise {
                exercise_template_id: ex.exercise_template_id.clone(),
                superset_id: ex.superset_group,
                rest_seconds: ex.rest_seconds,
                notes: ex.notes.clone(),
                sets,
            }
        })
        .collect();

    let title = build_routine_name(micro);

    Ok(CreateRoutineBody {
        title,
        folder_id,
        notes: None,
        exercises: routine_exercises,
    })
}

// --- Tauri commands ---

#[tauri::command]
pub async fn get_sync_status(
    state: State<'_, Mutex<AppState>>,
    program_id: String,
) -> Result<Option<SyncRecord>, String> {
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let result = app_state.db.query_row(
        "SELECT id, program_id, hevy_folder_id, hevy_folder_title, last_synced_at, sync_status, sync_mode, sync_direction, block_id FROM sync_records WHERE program_id = ?1",
        rusqlite::params![program_id],
        |row| {
            Ok(SyncRecord {
                id: row.get(0)?,
                program_id: row.get(1)?,
                hevy_folder_id: row.get(2)?,
                hevy_folder_title: row.get(3)?,
                last_synced_at: row.get(4)?,
                sync_status: row.get(5)?,
                sync_mode: row.get(6)?,
                sync_direction: row.get(7)?,
                block_id: row.get(8)?,
            })
        },
    );

    match result {
        Ok(record) => Ok(Some(record)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("DB error: {}", e)),
    }
}

#[tauri::command]
pub async fn preview_sync(
    state: State<'_, Mutex<AppState>>,
    program_id: String,
) -> Result<SyncPreview, String> {
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    // Get program name
    let program_name: String = app_state
        .db
        .query_row(
            "SELECT name FROM programs WHERE id = ?1",
            rusqlite::params![program_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Program not found: {}", e))?;

    // Collect all microcycles
    let microcycles = collect_microcycles(&app_state.db, &program_id)?;

    // Get existing sync record (if any)
    let sync_record_id: Option<String> = app_state
        .db
        .query_row(
            "SELECT id FROM sync_records WHERE program_id = ?1",
            rusqlite::params![program_id],
            |row| row.get(0),
        )
        .ok();

    // Get existing synced routines
    let mut synced_map: HashMap<String, (String, String)> = HashMap::new(); // microcycle_id -> (hevy_routine_id, synced_routine_name)
    if let Some(ref sr_id) = sync_record_id {
        let mut stmt = app_state
            .db
            .prepare(
                "SELECT microcycle_id, hevy_routine_id FROM synced_routines WHERE sync_record_id = ?1 AND hevy_routine_id IS NOT NULL",
            )
            .map_err(|e| format!("DB error: {}", e))?;

        let rows: Vec<(String, String)> = stmt
            .query_map(rusqlite::params![sr_id], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .map_err(|e| format!("DB error: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("DB error: {}", e))?;

        for (mid, hrid) in rows {
            synced_map.insert(mid, (hrid, String::new()));
        }
    }

    // Build routine previews
    let micro_ids: std::collections::HashSet<String> =
        microcycles.iter().map(|m| m.id.clone()).collect();

    let mut routines = Vec::new();
    let mut total_create = 0;
    let mut total_update = 0;

    for micro in &microcycles {
        let name = build_routine_name(micro);
        let (is_update, hevy_routine_id) = if let Some((hrid, _)) = synced_map.get(&micro.id) {
            (true, Some(hrid.clone()))
        } else {
            (false, None)
        };

        if is_update {
            total_update += 1;
        } else {
            total_create += 1;
        }

        routines.push(SyncPreviewRoutine {
            microcycle_id: micro.id.clone(),
            name,
            is_update,
            hevy_routine_id,
        });
    }

    // Detect orphaned routines (synced but microcycle no longer exists)
    let mut orphaned_routines = Vec::new();
    if let Some(ref sr_id) = sync_record_id {
        let mut stmt = app_state
            .db
            .prepare(
                "SELECT sr.hevy_routine_id, sr.microcycle_id FROM synced_routines sr WHERE sr.sync_record_id = ?1 AND sr.hevy_routine_id IS NOT NULL",
            )
            .map_err(|e| format!("DB error: {}", e))?;

        let all_synced: Vec<(String, String)> = stmt
            .query_map(rusqlite::params![sr_id], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .map_err(|e| format!("DB error: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("DB error: {}", e))?;

        for (hrid, mid) in all_synced {
            if !micro_ids.contains(&mid) {
                // Try to get a name from the old microcycle (it may have been deleted)
                let name = app_state
                    .db
                    .query_row(
                        "SELECT name FROM microcycles WHERE id = ?1",
                        rusqlite::params![mid],
                        |row| row.get::<_, String>(0),
                    )
                    .unwrap_or_else(|_| format!("Routine {}", hrid));
                orphaned_routines.push(OrphanedRoutine {
                    hevy_routine_id: hrid,
                    name,
                });
            }
        }
    }

    Ok(SyncPreview {
        folder_name: program_name,
        routines,
        orphaned_routines,
        total_create,
        total_update,
    })
}

#[tauri::command]
pub async fn execute_sync(
    state: State<'_, Mutex<AppState>>,
    program_id: String,
    rename_orphans: bool,
) -> Result<SyncResult, String> {
    // Get API key
    let api_key = keyring::Entry::new("hevy-program-extension", "api-key")
        .map_err(|e| format!("Keyring error: {}", e))?
        .get_password()
        .map_err(|_| "No API key configured".to_string())?;

    let client = HevyClient::new(api_key);

    // Read all data we need from DB while holding the lock
    let (
        program_name,
        microcycles,
        sync_record_id,
        hevy_folder_id,
        synced_routines_map,
    ) = {
        let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

        let program_name: String = app_state
            .db
            .query_row(
                "SELECT name FROM programs WHERE id = ?1",
                rusqlite::params![program_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Program not found: {}", e))?;

        let microcycles = collect_microcycles(&app_state.db, &program_id)?;

        // Get existing sync record
        let sync_info: Option<(String, Option<i64>)> = app_state
            .db
            .query_row(
                "SELECT id, hevy_folder_id FROM sync_records WHERE program_id = ?1",
                rusqlite::params![program_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok();

        let (sync_record_id, hevy_folder_id) = match sync_info {
            Some((id, fid)) => (Some(id), fid),
            None => (None, None),
        };

        // Get existing synced routines
        let mut synced_map: HashMap<String, String> = HashMap::new();
        if let Some(ref sr_id) = sync_record_id {
            let mut stmt = app_state
                .db
                .prepare(
                    "SELECT microcycle_id, hevy_routine_id FROM synced_routines WHERE sync_record_id = ?1 AND hevy_routine_id IS NOT NULL",
                )
                .map_err(|e| format!("DB error: {}", e))?;

            let rows: Vec<(String, String)> = stmt
                .query_map(rusqlite::params![sr_id], |row| {
                    Ok((row.get(0)?, row.get(1)?))
                })
                .map_err(|e| format!("DB error: {}", e))?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("DB error: {}", e))?;

            for (mid, hrid) in rows {
                synced_map.insert(mid, hrid);
            }
        }

        (
            program_name,
            microcycles,
            sync_record_id,
            hevy_folder_id,
            synced_map,
        )
    };
    // Lock released here

    let mut errors = Vec::new();
    let mut created = 0;
    let mut updated = 0;

    // Step 1: Create or reuse folder
    let folder_id = if let Some(fid) = hevy_folder_id {
        // Verify the folder still exists on Hevy by trying to list and find it
        // If the folder was deleted on Hevy, create a new one
        let mut found = false;
        let mut page = 1;
        loop {
            match client.get_routine_folders(page, 10).await {
                Ok(resp) => {
                    if resp.routine_folders.iter().any(|f| f.id == fid) {
                        found = true;
                        break;
                    }
                    if page >= resp.page_count {
                        break;
                    }
                    page += 1;
                }
                Err(_) => break,
            }
        }
        if found {
            fid
        } else {
            // Folder was deleted on Hevy, create a new one
            match client.create_routine_folder(&program_name).await {
                Ok(folder) => folder.id,
                Err(e) => return Err(format!("Failed to create routine folder: {}", e)),
            }
        }
    } else {
        match client.create_routine_folder(&program_name).await {
            Ok(folder) => folder.id,
            Err(e) => return Err(format!("Failed to create routine folder: {}", e)),
        }
    };

    // Step 2: Upsert sync_record
    let sync_record_id = {
        let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        if let Some(sr_id) = sync_record_id {
            // Update existing
            app_state
                .db
                .execute(
                    "UPDATE sync_records SET hevy_folder_id = ?1, hevy_folder_title = ?2, updated_at = datetime('now') WHERE id = ?3",
                    rusqlite::params![folder_id, program_name, sr_id],
                )
                .map_err(|e| format!("DB error: {}", e))?;
            sr_id
        } else {
            // Create new
            let id = Uuid::new_v4().to_string();
            app_state
                .db
                .execute(
                    "INSERT INTO sync_records (id, program_id, hevy_folder_id, hevy_folder_title, sync_status) VALUES (?1, ?2, ?3, ?4, 'synced')",
                    rusqlite::params![id, program_id, folder_id, program_name],
                )
                .map_err(|e| format!("DB error: {}", e))?;
            id
        }
    };

    // Step 3: Create/update routines
    for micro in &microcycles {
        let body = {
            let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
            build_routine_body(&app_state.db, &program_id, micro, Some(folder_id))?
        };

        if let Some(hevy_rid) = synced_routines_map.get(&micro.id) {
            // Update existing routine
            match client.update_routine(hevy_rid, body).await {
                Ok(_) => {
                    updated += 1;
                    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
                    app_state.db.execute(
                        "UPDATE synced_routines SET sync_status = 'synced', last_synced_at = datetime('now'), error_message = NULL WHERE sync_record_id = ?1 AND microcycle_id = ?2",
                        rusqlite::params![sync_record_id, micro.id],
                    ).ok();
                }
                Err(e) => {
                    errors.push(format!("Failed to update routine '{}': {}", build_routine_name(micro), e));
                    let app_state = state.lock().map_err(|e2| format!("Lock error: {}", e2))?;
                    app_state.db.execute(
                        "UPDATE synced_routines SET sync_status = 'error', error_message = ?1 WHERE sync_record_id = ?2 AND microcycle_id = ?3",
                        rusqlite::params![e, sync_record_id, micro.id],
                    ).ok();
                }
            }
        } else {
            // Create new routine
            match client.create_routine(body).await {
                Ok(resp) => {
                    created += 1;
                    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
                    let sr_row_id = Uuid::new_v4().to_string();
                    app_state.db.execute(
                        "INSERT INTO synced_routines (id, sync_record_id, microcycle_id, hevy_routine_id, sync_status, last_synced_at) VALUES (?1, ?2, ?3, ?4, 'synced', datetime('now')) ON CONFLICT(microcycle_id) DO UPDATE SET hevy_routine_id = ?4, sync_status = 'synced', last_synced_at = datetime('now'), error_message = NULL",
                        rusqlite::params![sr_row_id, sync_record_id, micro.id, resp.id],
                    ).map_err(|e| format!("DB error: {}", e))?;
                }
                Err(e) => {
                    errors.push(format!("Failed to create routine '{}': {}", build_routine_name(micro), e));
                }
            }
        }
    }

    // Step 4: Handle orphaned routines
    let mut orphans_renamed = 0;
    if rename_orphans {
        let micro_ids: std::collections::HashSet<String> =
            microcycles.iter().map(|m| m.id.clone()).collect();

        let orphans: Vec<(String, String)> = {
            let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
            let mut stmt = app_state
                .db
                .prepare(
                    "SELECT hevy_routine_id, microcycle_id FROM synced_routines WHERE sync_record_id = ?1 AND hevy_routine_id IS NOT NULL",
                )
                .map_err(|e| format!("DB error: {}", e))?;

            let results: Vec<(String, String)> = stmt.query_map(rusqlite::params![sync_record_id], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .map_err(|e| format!("DB error: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("DB error: {}", e))?;
            results
        };

        for (hrid, mid) in orphans {
            if !micro_ids.contains(&mid) {
                // Rename this routine with [REMOVED] prefix
                let rename_body = CreateRoutineBody {
                    title: format!("[REMOVED]"),
                    folder_id: None,
                    notes: None,
                    exercises: Vec::new(),
                };
                match client.update_routine(&hrid, rename_body).await {
                    Ok(_) => {
                        orphans_renamed += 1;
                        // Clean up the synced_routine record
                        let app_state =
                            state.lock().map_err(|e| format!("Lock error: {}", e))?;
                        app_state
                            .db
                            .execute(
                                "DELETE FROM synced_routines WHERE hevy_routine_id = ?1",
                                rusqlite::params![hrid],
                            )
                            .ok();
                    }
                    Err(e) => {
                        errors.push(format!("Failed to rename orphaned routine: {}", e));
                    }
                }
            }
        }
    }

    // Step 5: Update sync_record status
    {
        let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        let status = if errors.is_empty() { "synced" } else { "error" };
        app_state
            .db
            .execute(
                "UPDATE sync_records SET sync_status = ?1, last_synced_at = datetime('now'), updated_at = datetime('now') WHERE id = ?2",
                rusqlite::params![status, sync_record_id],
            )
            .map_err(|e| format!("DB error: {}", e))?;
    }

    Ok(SyncResult {
        success: errors.is_empty(),
        created,
        updated,
        orphans_renamed,
        errors,
    })
}

// --- Import types ---

#[derive(Debug, Serialize)]
pub struct HevyFolderInfo {
    pub id: i64,
    pub title: String,
    pub routine_count: usize,
    pub already_linked: bool,
    pub linked_program_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ImportPreviewRoutine {
    pub hevy_routine_id: String,
    pub title: String,
    pub exercise_count: usize,
    pub set_count: usize,
    pub parsed_week: Option<i32>,
    pub parsed_day: Option<i32>,
    pub parsed_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ImportWeek {
    pub week_number: i32,
    pub days: Vec<ImportDay>,
}

#[derive(Debug, Serialize)]
pub struct ImportDay {
    pub day_number: i32,
    pub routine_title: String,
    pub hevy_routine_id: String,
    pub exercise_count: usize,
    pub set_count: usize,
}

#[derive(Debug, Serialize)]
pub struct ImportPreview {
    pub folder_name: String,
    pub folder_id: i64,
    pub routines: Vec<ImportPreviewRoutine>,
    pub weeks: Vec<ImportWeek>,
}

#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub success: bool,
    pub program_id: String,
    pub program_name: String,
    pub microcycles_created: usize,
    pub exercises_imported: usize,
    pub errors: Vec<String>,
}

// --- Import helpers ---

struct ParsedRoutineTitle {
    week: Option<i32>,
    day: Option<i32>,
    name: Option<String>,
}

fn parse_routine_title(title: &str) -> ParsedRoutineTitle {
    let re = Regex::new(r"^W(\d+)D(\d+)(?:\s*-\s*(.+))?$").unwrap();
    if let Some(caps) = re.captures(title) {
        ParsedRoutineTitle {
            week: caps.get(1).and_then(|m| m.as_str().parse().ok()),
            day: caps.get(2).and_then(|m| m.as_str().parse().ok()),
            name: caps.get(3).map(|m| m.as_str().trim().to_string()),
        }
    } else {
        ParsedRoutineTitle {
            week: None,
            day: None,
            name: Some(title.to_string()),
        }
    }
}

/// Normalize Hevy set types to our valid CHECK constraint values
fn normalize_set_type(hevy_type: &str) -> &str {
    match hevy_type {
        "warmup" | "normal" | "failure" | "dropset" => hevy_type,
        _ => "normal",
    }
}

fn write_exercises_to_microcycle(
    db: &rusqlite::Connection,
    microcycle_id: &str,
    exercises: &[RoutineExerciseResponse],
) -> Result<(usize, usize), String> {
    let mut exercise_count = 0;
    let mut set_count = 0;

    for (ex_idx, ex) in exercises.iter().enumerate() {
        let ex_id = Uuid::new_v4().to_string();
        db.execute(
            "INSERT INTO program_exercises (id, microcycle_id, exercise_template_id, sort_order, superset_group, rest_seconds, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                ex_id,
                microcycle_id,
                ex.exercise_template_id,
                ex_idx as i32,
                ex.supersets_id,
                ex.rest_seconds,
                ex.notes,
            ],
        )
        .map_err(|e| format!("DB error inserting exercise: {}", e))?;
        exercise_count += 1;

        for (set_idx, s) in ex.sets.iter().enumerate() {
            let set_id = Uuid::new_v4().to_string();
            let (rep_start, rep_end) = match &s.rep_range {
                Some(rr) => (rr.start, rr.end),
                None => (None, None),
            };
            db.execute(
                "INSERT INTO program_sets (id, program_exercise_id, sort_order, set_type, reps, rep_range_start, rep_range_end, weight_kg, percentage_of_tm, rpe_target, duration_seconds, distance_meters, custom_metric) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                rusqlite::params![
                    set_id,
                    ex_id,
                    set_idx as i32,
                    normalize_set_type(&s.set_type),
                    s.reps,
                    rep_start,
                    rep_end,
                    s.weight_kg,
                    None::<f64>, // percentage_of_tm
                    s.rpe,       // rpe_target
                    s.duration_seconds,
                    s.distance_meters,
                    s.custom_metric,
                ],
            )
            .map_err(|e| format!("DB error inserting set: {}", e))?;
            set_count += 1;
        }
    }

    Ok((exercise_count, set_count))
}

// --- Import Tauri commands ---

#[tauri::command]
pub async fn list_hevy_folders(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<HevyFolderInfo>, String> {
    let api_key = keyring::Entry::new("hevy-program-extension", "api-key")
        .map_err(|e| format!("Keyring error: {}", e))?
        .get_password()
        .map_err(|_| "No API key configured".to_string())?;

    let client = HevyClient::new(api_key);

    // Fetch all folders
    let folders = client.get_all_routine_folders().await?;

    // Fetch all routines to count per folder
    let mut all_routines = Vec::new();
    let mut page = 1;
    loop {
        let resp = client.get_routines(page, 10).await?;
        all_routines.extend(resp.routines);
        if page >= resp.page_count {
            break;
        }
        page += 1;
    }

    // Count routines per folder
    let mut folder_counts: HashMap<i64, usize> = HashMap::new();
    for r in &all_routines {
        if let Some(fid) = r.folder_id {
            *folder_counts.entry(fid).or_insert(0) += 1;
        }
    }

    // Check linked folders
    let linked_folders: HashMap<i64, String> = {
        let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        let mut stmt = app_state
            .db
            .prepare("SELECT sr.hevy_folder_id, p.name FROM sync_records sr JOIN programs p ON p.id = sr.program_id WHERE sr.hevy_folder_id IS NOT NULL")
            .map_err(|e| format!("DB error: {}", e))?;

        let rows: Vec<(i64, String)> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|e| format!("DB error: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("DB error: {}", e))?;

        rows.into_iter().collect()
    };

    let result = folders
        .into_iter()
        .map(|f| {
            let already_linked = linked_folders.contains_key(&f.id);
            let linked_program_name = linked_folders.get(&f.id).cloned();
            HevyFolderInfo {
                id: f.id,
                title: f.title,
                routine_count: *folder_counts.get(&f.id).unwrap_or(&0),
                already_linked,
                linked_program_name,
            }
        })
        .collect();

    Ok(result)
}

#[tauri::command]
pub async fn preview_import(
    _state: State<'_, Mutex<AppState>>,
    folder_id: i64,
) -> Result<ImportPreview, String> {
    let api_key = keyring::Entry::new("hevy-program-extension", "api-key")
        .map_err(|e| format!("Keyring error: {}", e))?
        .get_password()
        .map_err(|_| "No API key configured".to_string())?;

    let client = HevyClient::new(api_key);

    // Get folder name
    let folders = client.get_all_routine_folders().await?;
    let folder = folders
        .iter()
        .find(|f| f.id == folder_id)
        .ok_or("Folder not found")?;
    let folder_name = folder.title.clone();

    // Fetch all routines with full detail
    let details = client.get_routines_detail_by_folder(folder_id).await?;

    // Parse routine titles and build preview
    let mut routines = Vec::new();
    for detail in &details {
        let parsed = parse_routine_title(&detail.title);
        let set_count: usize = detail.exercises.iter().map(|e| e.sets.len()).sum();
        routines.push(ImportPreviewRoutine {
            hevy_routine_id: detail.id.clone(),
            title: detail.title.clone(),
            exercise_count: detail.exercises.len(),
            set_count,
            parsed_week: parsed.week,
            parsed_day: parsed.day,
            parsed_name: parsed.name,
        });
    }

    // Organize into weeks
    let mut week_map: HashMap<i32, Vec<ImportDay>> = HashMap::new();
    let mut unparsed_day_counter = 1;
    for r in &routines {
        let week = r.parsed_week.unwrap_or(1);
        let day = r.parsed_day.unwrap_or_else(|| {
            let d = unparsed_day_counter;
            unparsed_day_counter += 1;
            d
        });
        week_map.entry(week).or_default().push(ImportDay {
            day_number: day,
            routine_title: r.title.clone(),
            hevy_routine_id: r.hevy_routine_id.clone(),
            exercise_count: r.exercise_count,
            set_count: r.set_count,
        });
    }

    let mut weeks: Vec<ImportWeek> = week_map
        .into_iter()
        .map(|(wn, mut days)| {
            days.sort_by_key(|d| d.day_number);
            ImportWeek {
                week_number: wn,
                days,
            }
        })
        .collect();
    weeks.sort_by_key(|w| w.week_number);

    Ok(ImportPreview {
        folder_name,
        folder_id,
        routines,
        weeks,
    })
}

#[tauri::command]
pub async fn execute_import(
    state: State<'_, Mutex<AppState>>,
    folder_id: i64,
    program_name: String,
    target_program_id: Option<String>,
    target_mode: String, // "new_program" or "new_block"
) -> Result<ImportResult, String> {
    let api_key = keyring::Entry::new("hevy-program-extension", "api-key")
        .map_err(|e| format!("Keyring error: {}", e))?
        .get_password()
        .map_err(|_| "No API key configured".to_string())?;

    let client = HevyClient::new(api_key);

    // Fetch all routines with full detail
    let details = client.get_routines_detail_by_folder(folder_id).await?;

    // Get folder title
    let folders = client.get_all_routine_folders().await?;
    let folder_title = folders
        .iter()
        .find(|f| f.id == folder_id)
        .map(|f| f.title.clone())
        .unwrap_or_else(|| program_name.clone());

    // Parse structure
    let mut parsed_routines: Vec<(i32, i32, Option<String>, &RoutineDetailResponse)> = Vec::new();
    let mut unparsed_day_counter = 1;
    for detail in &details {
        let parsed = parse_routine_title(&detail.title);
        let week = parsed.week.unwrap_or(1);
        let day = parsed.day.unwrap_or_else(|| {
            let d = unparsed_day_counter;
            unparsed_day_counter += 1;
            d
        });
        let name = parsed.name.unwrap_or_else(|| format!("Day {}", day));
        parsed_routines.push((week, day, Some(name), detail));
    }
    parsed_routines.sort_by_key(|(w, d, _, _)| (*w, *d));

    // Now do all DB writes
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    app_state
        .db
        .execute("BEGIN", [])
        .map_err(|e| format!("DB error: {}", e))?;

    let result = (|| -> Result<ImportResult, String> {
        let actual_program_id;
        let block_id = Uuid::new_v4().to_string();

        if target_mode == "new_block" {
            // Add block to existing program
            let pid = target_program_id
                .as_ref()
                .ok_or("target_program_id required for new_block mode")?;
            actual_program_id = pid.clone();

            let max_order: i32 = app_state
                .db
                .query_row(
                    "SELECT COALESCE(MAX(sort_order), -1) FROM blocks WHERE program_id = ?1",
                    rusqlite::params![actual_program_id],
                    |row| row.get(0),
                )
                .unwrap_or(-1);

            app_state.db.execute(
                "INSERT INTO blocks (id, program_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![block_id, actual_program_id, program_name, max_order + 1],
            ).map_err(|e| format!("DB error: {}", e))?;
        } else {
            // Create new program
            actual_program_id = Uuid::new_v4().to_string();
            app_state.db.execute(
                "INSERT INTO programs (id, name) VALUES (?1, ?2)",
                rusqlite::params![actual_program_id, program_name],
            ).map_err(|e| format!("DB error: {}", e))?;

            // Create default block
            app_state.db.execute(
                "INSERT INTO blocks (id, program_id, name, sort_order) VALUES (?1, ?2, ?3, 0)",
                rusqlite::params![block_id, actual_program_id, "Block 1"],
            ).map_err(|e| format!("DB error: {}", e))?;
        }

        // Create sync_record
        let sync_record_id = Uuid::new_v4().to_string();
        app_state.db.execute(
            "INSERT INTO sync_records (id, program_id, hevy_folder_id, hevy_folder_title, sync_status, sync_mode, sync_direction) VALUES (?1, ?2, ?3, ?4, 'synced', 'program', 'pull')",
            rusqlite::params![sync_record_id, actual_program_id, folder_id, folder_title],
        ).map_err(|e| format!("DB error: {}", e))?;

        // Group by week
        let mut week_numbers: Vec<i32> = parsed_routines.iter().map(|(w, _, _, _)| *w).collect();
        week_numbers.sort();
        week_numbers.dedup();

        let mut mesocycle_ids: HashMap<i32, String> = HashMap::new();
        for (sort_idx, &wn) in week_numbers.iter().enumerate() {
            let meso_id = Uuid::new_v4().to_string();
            app_state.db.execute(
                "INSERT INTO mesocycles (id, block_id, name, week_number, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![meso_id, block_id, format!("Week {}", wn), wn, sort_idx as i32],
            ).map_err(|e| format!("DB error: {}", e))?;
            mesocycle_ids.insert(wn, meso_id);
        }

        let mut total_exercises = 0;
        let mut total_microcycles = 0;
        let mut errors = Vec::new();

        for (week, day, name, detail) in &parsed_routines {
            let meso_id = mesocycle_ids.get(week).unwrap();
            let micro_id = Uuid::new_v4().to_string();
            let micro_name = name.clone().unwrap_or_else(|| format!("Day {}", day));

            let sort_order: i32 = app_state
                .db
                .query_row(
                    "SELECT COALESCE(MAX(sort_order), -1) FROM microcycles WHERE mesocycle_id = ?1",
                    rusqlite::params![meso_id],
                    |row| row.get(0),
                )
                .unwrap_or(-1);

            app_state.db.execute(
                "INSERT INTO microcycles (id, mesocycle_id, name, day_number, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![micro_id, meso_id, micro_name, day, sort_order + 1],
            ).map_err(|e| format!("DB error: {}", e))?;
            total_microcycles += 1;

            // Write exercises and sets
            match write_exercises_to_microcycle(&app_state.db, &micro_id, &detail.exercises) {
                Ok((ex_count, _)) => {
                    total_exercises += ex_count;
                }
                Err(e) => {
                    errors.push(format!("Error importing exercises for '{}': {}", detail.title, e));
                }
            }

            // Create synced_routine record
            let sr_id = Uuid::new_v4().to_string();
            app_state.db.execute(
                "INSERT INTO synced_routines (id, sync_record_id, microcycle_id, hevy_routine_id, sync_status, last_synced_at) VALUES (?1, ?2, ?3, ?4, 'synced', datetime('now'))",
                rusqlite::params![sr_id, sync_record_id, micro_id, detail.id],
            ).map_err(|e| format!("DB error: {}", e))?;
        }

        // Update sync_record timestamp
        app_state.db.execute(
            "UPDATE sync_records SET last_synced_at = datetime('now') WHERE id = ?1",
            rusqlite::params![sync_record_id],
        ).ok();

        // Update program timestamp
        app_state.db.execute(
            "UPDATE programs SET updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![actual_program_id],
        ).ok();

        Ok(ImportResult {
            success: errors.is_empty(),
            program_id: actual_program_id,
            program_name: program_name.clone(),
            microcycles_created: total_microcycles,
            exercises_imported: total_exercises,
            errors,
        })
    })();

    match result {
        Ok(r) => {
            app_state
                .db
                .execute("COMMIT", [])
                .map_err(|e| format!("DB error: {}", e))?;
            Ok(r)
        }
        Err(e) => {
            app_state.db.execute("ROLLBACK", []).ok();
            Err(e)
        }
    }
}

// --- Pull types ---

#[derive(Debug, Serialize)]
pub struct PullChange {
    pub microcycle_id: String,
    pub microcycle_name: String,
    pub hevy_routine_id: String,
    pub local_exercise_count: usize,
    pub remote_exercise_count: usize,
    pub local_set_count: usize,
    pub remote_set_count: usize,
    pub has_changes: bool,
}

#[derive(Debug, Serialize)]
pub struct PullPreview {
    pub changes: Vec<PullChange>,
    pub unchanged: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct PullResult {
    pub success: bool,
    pub updated_microcycles: usize,
    pub errors: Vec<String>,
}

// --- Pull Tauri commands ---

#[tauri::command]
pub async fn preview_pull(
    state: State<'_, Mutex<AppState>>,
    program_id: String,
) -> Result<PullPreview, String> {
    let api_key = keyring::Entry::new("hevy-program-extension", "api-key")
        .map_err(|e| format!("Keyring error: {}", e))?
        .get_password()
        .map_err(|_| "No API key configured".to_string())?;

    let client = HevyClient::new(api_key);

    // Gather all local data while holding the lock
    struct LocalInfo {
        microcycle_id: String,
        hevy_routine_id: String,
        microcycle_name: String,
        exercise_count: usize,
        set_count: usize,
        template_ids: Vec<String>,
    }

    let local_infos: Vec<LocalInfo> = {
        let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

        let mut stmt = app_state.db.prepare(
            "SELECT sr.microcycle_id, sr.hevy_routine_id, m.name as microcycle_name
             FROM synced_routines sr
             JOIN microcycles m ON m.id = sr.microcycle_id
             JOIN sync_records rec ON rec.id = sr.sync_record_id
             WHERE rec.program_id = ?1 AND sr.sync_status = 'synced'"
        ).map_err(|e| format!("DB error: {}", e))?;

        let synced: Vec<(String, String, String)> = stmt.query_map(
            rusqlite::params![program_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .map_err(|e| format!("DB error: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("DB error: {}", e))?;

        let mut infos = Vec::new();
        for (microcycle_id, hevy_routine_id, microcycle_name) in synced {
            let exercise_count: usize = app_state
                .db
                .query_row(
                    "SELECT COUNT(*) FROM program_exercises WHERE microcycle_id = ?1",
                    rusqlite::params![microcycle_id],
                    |row| row.get(0),
                )
                .unwrap_or(0);

            let set_count: usize = app_state
                .db
                .query_row(
                    "SELECT COUNT(*) FROM program_sets ps
                     JOIN program_exercises pe ON pe.id = ps.program_exercise_id
                     WHERE pe.microcycle_id = ?1",
                    rusqlite::params![microcycle_id],
                    |row| row.get(0),
                )
                .unwrap_or(0);

            let mut tmpl_stmt = app_state.db.prepare(
                "SELECT exercise_template_id FROM program_exercises
                 WHERE microcycle_id = ?1 ORDER BY sort_order"
            ).map_err(|e| format!("DB error: {}", e))?;

            let template_ids: Vec<String> = tmpl_stmt
                .query_map(rusqlite::params![microcycle_id], |row| row.get(0))
                .map_err(|e| format!("DB error: {}", e))?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("DB error: {}", e))?;

            infos.push(LocalInfo {
                microcycle_id,
                hevy_routine_id,
                microcycle_name,
                exercise_count,
                set_count,
                template_ids,
            });
        }

        infos
    }; // lock released here

    // Fetch remote data and compare (no lock held)
    let mut changes = Vec::new();
    let mut unchanged = Vec::new();

    for info in &local_infos {
        match client.get_routine(&info.hevy_routine_id).await {
            Ok(detail) => {
                let remote_exercise_count = detail.exercises.len();
                let remote_set_count: usize = detail.exercises.iter().map(|e| e.sets.len()).sum();
                let remote_templates: Vec<&str> = detail
                    .exercises
                    .iter()
                    .map(|e| e.exercise_template_id.as_str())
                    .collect();

                let has_changes = info.exercise_count != remote_exercise_count
                    || info.set_count != remote_set_count
                    || info.template_ids.iter().map(|s| s.as_str()).collect::<Vec<_>>() != remote_templates;

                if has_changes {
                    changes.push(PullChange {
                        microcycle_id: info.microcycle_id.clone(),
                        microcycle_name: info.microcycle_name.clone(),
                        hevy_routine_id: info.hevy_routine_id.clone(),
                        local_exercise_count: info.exercise_count,
                        remote_exercise_count,
                        local_set_count: info.set_count,
                        remote_set_count,
                        has_changes,
                    });
                } else {
                    unchanged.push(info.microcycle_name.clone());
                }
            }
            Err(e) => {
                changes.push(PullChange {
                    microcycle_id: info.microcycle_id.clone(),
                    microcycle_name: format!("{} (fetch error: {})", info.microcycle_name, e),
                    hevy_routine_id: info.hevy_routine_id.clone(),
                    local_exercise_count: info.exercise_count,
                    remote_exercise_count: 0,
                    local_set_count: info.set_count,
                    remote_set_count: 0,
                    has_changes: false,
                });
            }
        }
    }

    Ok(PullPreview { changes, unchanged })
}

#[tauri::command]
pub async fn execute_pull(
    state: State<'_, Mutex<AppState>>,
    program_id: String,
    microcycle_ids: Vec<String>,
) -> Result<PullResult, String> {
    let api_key = keyring::Entry::new("hevy-program-extension", "api-key")
        .map_err(|e| format!("Keyring error: {}", e))?
        .get_password()
        .map_err(|_| "No API key configured".to_string())?;

    let client = HevyClient::new(api_key);

    let mut updated = 0;
    let mut errors = Vec::new();

    for microcycle_id in &microcycle_ids {
        // Get the hevy_routine_id for this microcycle
        let hevy_routine_id: String = {
            let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
            app_state.db.query_row(
                "SELECT sr.hevy_routine_id FROM synced_routines sr
                 JOIN sync_records rec ON rec.id = sr.sync_record_id
                 WHERE sr.microcycle_id = ?1 AND rec.program_id = ?2",
                rusqlite::params![microcycle_id, program_id],
                |row| row.get(0),
            ).map_err(|e| format!("No synced routine found for microcycle {}: {}", microcycle_id, e))?
        };

        // Fetch routine detail from Hevy
        let detail = match client.get_routine(&hevy_routine_id).await {
            Ok(d) => d,
            Err(e) => {
                errors.push(format!("Failed to fetch routine {}: {}", hevy_routine_id, e));
                continue;
            }
        };

        // Update local data in a transaction
        let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

        app_state.db.execute("BEGIN", []).map_err(|e| format!("DB error: {}", e))?;

        let result: Result<(), String> = (|| {
            // Delete existing exercises and sets for this microcycle
            app_state.db.execute(
                "DELETE FROM program_sets WHERE program_exercise_id IN
                 (SELECT id FROM program_exercises WHERE microcycle_id = ?1)",
                rusqlite::params![microcycle_id],
            ).map_err(|e| format!("DB error: {}", e))?;

            app_state.db.execute(
                "DELETE FROM program_exercises WHERE microcycle_id = ?1",
                rusqlite::params![microcycle_id],
            ).map_err(|e| format!("DB error: {}", e))?;

            // Write new exercises from Hevy
            write_exercises_to_microcycle(&app_state.db, microcycle_id, &detail.exercises)?;

            // Update synced_routines timestamp
            app_state.db.execute(
                "UPDATE synced_routines SET last_synced_at = datetime('now')
                 WHERE microcycle_id = ?1",
                rusqlite::params![microcycle_id],
            ).map_err(|e| format!("DB error: {}", e))?;

            Ok(())
        })();

        match result {
            Ok(()) => {
                app_state.db.execute("COMMIT", []).map_err(|e| format!("DB error: {}", e))?;
                updated += 1;
            }
            Err(e) => {
                app_state.db.execute("ROLLBACK", []).ok();
                errors.push(format!("Failed to update microcycle {}: {}", microcycle_id, e));
            }
        }
    }

    // Update program timestamp
    {
        let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        app_state.db.execute(
            "UPDATE programs SET updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![program_id],
        ).ok();
    }

    Ok(PullResult {
        success: errors.is_empty(),
        updated_microcycles: updated,
        errors,
    })
}
