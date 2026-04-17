use crate::hevy::client::{
    CreateRoutineBody, HevyClient, RepRange, RoutineExercise, RoutineSet,
};
use crate::models::sync_metadata::SyncRecord;
use crate::AppState;
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
        "SELECT id, program_id, hevy_folder_id, hevy_folder_title, last_synced_at, sync_status FROM sync_records WHERE program_id = ?1",
        rusqlite::params![program_id],
        |row| {
            Ok(SyncRecord {
                id: row.get(0)?,
                program_id: row.get(1)?,
                hevy_folder_id: row.get(2)?,
                hevy_folder_title: row.get(3)?,
                last_synced_at: row.get(4)?,
                sync_status: row.get(5)?,
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
