use crate::models::program::*;
use crate::AppState;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn create_program(
    state: State<'_, Mutex<AppState>>,
    name: String,
    description: Option<String>,
) -> Result<Program, String> {
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let id = Uuid::new_v4().to_string();

    app_state
        .db
        .execute(
            "INSERT INTO programs (id, name, description) VALUES (?1, ?2, ?3)",
            rusqlite::params![id, name, description],
        )
        .map_err(|e| format!("DB error: {}", e))?;

    app_state
        .db
        .query_row(
            "SELECT id, name, description, created_at, updated_at FROM programs WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(Program {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            },
        )
        .map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub async fn get_programs(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<Program>, String> {
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let mut stmt = app_state
        .db
        .prepare("SELECT id, name, description, created_at, updated_at FROM programs ORDER BY updated_at DESC")
        .map_err(|e| format!("DB error: {}", e))?;

    let programs = stmt
        .query_map([], |row| {
            Ok(Program {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })
        .map_err(|e| format!("DB error: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("DB error: {}", e))?;

    Ok(programs)
}

#[tauri::command]
pub async fn get_program(
    state: State<'_, Mutex<AppState>>,
    id: String,
) -> Result<ProgramFull, String> {
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let program = app_state
        .db
        .query_row(
            "SELECT id, name, description, created_at, updated_at FROM programs WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(ProgramFull {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    blocks: Vec::new(),
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            },
        )
        .map_err(|e| format!("Program not found: {}", e))?;

    // Load blocks
    let mut block_stmt = app_state
        .db
        .prepare("SELECT id, program_id, name, sort_order, created_at, updated_at FROM blocks WHERE program_id = ?1 ORDER BY sort_order")
        .map_err(|e| format!("DB error: {}", e))?;

    let mut blocks: Vec<Block> = block_stmt
        .query_map(rusqlite::params![id], |row| {
            Ok(Block {
                id: row.get(0)?,
                program_id: row.get(1)?,
                name: row.get(2)?,
                sort_order: row.get(3)?,
                mesocycles: Vec::new(),
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| format!("DB error: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("DB error: {}", e))?;

    // Load mesocycles for each block
    for block in &mut blocks {
        let mut meso_stmt = app_state
            .db
            .prepare("SELECT id, block_id, name, week_number, sort_order, created_at, updated_at FROM mesocycles WHERE block_id = ?1 ORDER BY sort_order")
            .map_err(|e| format!("DB error: {}", e))?;

        let mut mesocycles: Vec<Mesocycle> = meso_stmt
            .query_map(rusqlite::params![block.id], |row| {
                Ok(Mesocycle {
                    id: row.get(0)?,
                    block_id: row.get(1)?,
                    name: row.get(2)?,
                    week_number: row.get(3)?,
                    sort_order: row.get(4)?,
                    microcycles: Vec::new(),
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            })
            .map_err(|e| format!("DB error: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("DB error: {}", e))?;

        // Load microcycles for each mesocycle
        for meso in &mut mesocycles {
            let mut micro_stmt = app_state
                .db
                .prepare("SELECT id, mesocycle_id, name, day_number, notes, sort_order, created_at, updated_at FROM microcycles WHERE mesocycle_id = ?1 ORDER BY sort_order")
                .map_err(|e| format!("DB error: {}", e))?;

            let mut microcycles: Vec<Microcycle> = micro_stmt
                .query_map(rusqlite::params![meso.id], |row| {
                    Ok(Microcycle {
                        id: row.get(0)?,
                        mesocycle_id: row.get(1)?,
                        name: row.get(2)?,
                        day_number: row.get(3)?,
                        notes: row.get(4)?,
                        sort_order: row.get(5)?,
                        exercises: Vec::new(),
                        created_at: row.get(6)?,
                        updated_at: row.get(7)?,
                    })
                })
                .map_err(|e| format!("DB error: {}", e))?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("DB error: {}", e))?;

            // Load exercises for each microcycle
            for micro in &mut microcycles {
                let mut ex_stmt = app_state
                    .db
                    .prepare("SELECT pe.id, pe.microcycle_id, pe.exercise_template_id, COALESCE(et.title, 'Unknown'), pe.sort_order, pe.superset_group, pe.rest_seconds, pe.notes FROM program_exercises pe LEFT JOIN exercise_templates et ON et.id = pe.exercise_template_id WHERE pe.microcycle_id = ?1 ORDER BY pe.sort_order")
                    .map_err(|e| format!("DB error: {}", e))?;

                let mut exercises: Vec<ProgramExercise> = ex_stmt
                    .query_map(rusqlite::params![micro.id], |row| {
                        Ok(ProgramExercise {
                            id: row.get(0)?,
                            microcycle_id: row.get(1)?,
                            exercise_template_id: row.get(2)?,
                            exercise_title: row.get(3)?,
                            sort_order: row.get(4)?,
                            superset_group: row.get(5)?,
                            rest_seconds: row.get(6)?,
                            notes: row.get(7)?,
                            sets: Vec::new(),
                        })
                    })
                    .map_err(|e| format!("DB error: {}", e))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| format!("DB error: {}", e))?;

                // Load sets for each exercise
                for ex in &mut exercises {
                    let mut set_stmt = app_state
                        .db
                        .prepare("SELECT id, program_exercise_id, sort_order, set_type, reps, rep_range_start, rep_range_end, weight_kg, percentage_of_tm, rpe_target, duration_seconds, distance_meters, custom_metric FROM program_sets WHERE program_exercise_id = ?1 ORDER BY sort_order")
                        .map_err(|e| format!("DB error: {}", e))?;

                    ex.sets = set_stmt
                        .query_map(rusqlite::params![ex.id], |row| {
                            Ok(ProgramSet {
                                id: row.get(0)?,
                                program_exercise_id: row.get(1)?,
                                sort_order: row.get(2)?,
                                set_type: row.get(3)?,
                                reps: row.get(4)?,
                                rep_range_start: row.get(5)?,
                                rep_range_end: row.get(6)?,
                                weight_kg: row.get(7)?,
                                percentage_of_tm: row.get(8)?,
                                rpe_target: row.get(9)?,
                                duration_seconds: row.get(10)?,
                                distance_meters: row.get(11)?,
                                custom_metric: row.get(12)?,
                            })
                        })
                        .map_err(|e| format!("DB error: {}", e))?
                        .collect::<Result<Vec<_>, _>>()
                        .map_err(|e| format!("DB error: {}", e))?;
                }

                micro.exercises = exercises;
            }

            meso.microcycles = microcycles;
        }

        block.mesocycles = mesocycles;
    }

    Ok(ProgramFull { blocks, ..program })
}

#[tauri::command]
pub async fn update_program(
    state: State<'_, Mutex<AppState>>,
    id: String,
    name: String,
    description: Option<String>,
) -> Result<(), String> {
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    app_state
        .db
        .execute(
            "UPDATE programs SET name = ?1, description = ?2, updated_at = datetime('now') WHERE id = ?3",
            rusqlite::params![name, description, id],
        )
        .map_err(|e| format!("DB error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_program(
    state: State<'_, Mutex<AppState>>,
    id: String,
) -> Result<(), String> {
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    app_state
        .db
        .execute("DELETE FROM programs WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| format!("DB error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn duplicate_program(
    state: State<'_, Mutex<AppState>>,
    id: String,
) -> Result<Program, String> {
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    // Get original program
    let (name, description): (String, Option<String>) = app_state
        .db
        .query_row(
            "SELECT name, description FROM programs WHERE id = ?1",
            rusqlite::params![id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Program not found: {}", e))?;

    let new_id = Uuid::new_v4().to_string();
    let new_name = format!("{} (copy)", name);

    app_state
        .db
        .execute(
            "INSERT INTO programs (id, name, description) VALUES (?1, ?2, ?3)",
            rusqlite::params![new_id, new_name, description],
        )
        .map_err(|e| format!("DB error: {}", e))?;

    // TODO: Deep copy blocks, mesocycles, microcycles, exercises, sets

    app_state
        .db
        .query_row(
            "SELECT id, name, description, created_at, updated_at FROM programs WHERE id = ?1",
            rusqlite::params![new_id],
            |row| {
                Ok(Program {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            },
        )
        .map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub async fn add_block(
    state: State<'_, Mutex<AppState>>,
    program_id: String,
    name: String,
) -> Result<serde_json::Value, String> {
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let id = Uuid::new_v4().to_string();

    let max_order: i32 = app_state
        .db
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM blocks WHERE program_id = ?1",
            rusqlite::params![program_id],
            |row| row.get(0),
        )
        .unwrap_or(-1);

    app_state
        .db
        .execute(
            "INSERT INTO blocks (id, program_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![id, program_id, name, max_order + 1],
        )
        .map_err(|e| format!("DB error: {}", e))?;

    // Update program timestamp
    app_state.db.execute(
        "UPDATE programs SET updated_at = datetime('now') WHERE id = ?1",
        rusqlite::params![program_id],
    ).ok();

    Ok(serde_json::json!({ "id": id }))
}

#[tauri::command]
pub async fn add_mesocycle(
    state: State<'_, Mutex<AppState>>,
    block_id: String,
    name: String,
    week_number: i32,
) -> Result<serde_json::Value, String> {
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let id = Uuid::new_v4().to_string();

    let max_order: i32 = app_state
        .db
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM mesocycles WHERE block_id = ?1",
            rusqlite::params![block_id],
            |row| row.get(0),
        )
        .unwrap_or(-1);

    app_state
        .db
        .execute(
            "INSERT INTO mesocycles (id, block_id, name, week_number, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![id, block_id, name, week_number, max_order + 1],
        )
        .map_err(|e| format!("DB error: {}", e))?;

    Ok(serde_json::json!({ "id": id }))
}

#[tauri::command]
pub async fn add_microcycle(
    state: State<'_, Mutex<AppState>>,
    mesocycle_id: String,
    name: String,
    day_number: i32,
) -> Result<serde_json::Value, String> {
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let id = Uuid::new_v4().to_string();

    let max_order: i32 = app_state
        .db
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM microcycles WHERE mesocycle_id = ?1",
            rusqlite::params![mesocycle_id],
            |row| row.get(0),
        )
        .unwrap_or(-1);

    app_state
        .db
        .execute(
            "INSERT INTO microcycles (id, mesocycle_id, name, day_number, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![id, mesocycle_id, name, day_number, max_order + 1],
        )
        .map_err(|e| format!("DB error: {}", e))?;

    Ok(serde_json::json!({ "id": id }))
}

#[tauri::command]
pub async fn delete_block(
    state: State<'_, Mutex<AppState>>,
    id: String,
) -> Result<(), String> {
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    app_state
        .db
        .execute("DELETE FROM blocks WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| format!("DB error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_mesocycle(
    state: State<'_, Mutex<AppState>>,
    id: String,
) -> Result<(), String> {
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    app_state
        .db
        .execute("DELETE FROM mesocycles WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| format!("DB error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_microcycle(
    state: State<'_, Mutex<AppState>>,
    id: String,
) -> Result<(), String> {
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    app_state
        .db
        .execute(
            "DELETE FROM microcycles WHERE id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| format!("DB error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn duplicate_mesocycle(
    state: State<'_, Mutex<AppState>>,
    mesocycle_id: String,
) -> Result<serde_json::Value, String> {
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let (block_id, _name, _week_number): (String, String, i32) = app_state
        .db
        .query_row(
            "SELECT block_id, name, week_number FROM mesocycles WHERE id = ?1",
            rusqlite::params![mesocycle_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| format!("Mesocycle not found: {}", e))?;

    let max_week: i32 = app_state
        .db
        .query_row(
            "SELECT COALESCE(MAX(week_number), 0) FROM mesocycles WHERE block_id = ?1",
            rusqlite::params![block_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let new_id = Uuid::new_v4().to_string();
    let new_name = format!("Week {}", max_week + 1);

    let max_order: i32 = app_state
        .db
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM mesocycles WHERE block_id = ?1",
            rusqlite::params![block_id],
            |row| row.get(0),
        )
        .unwrap_or(-1);

    app_state
        .db
        .execute(
            "INSERT INTO mesocycles (id, block_id, name, week_number, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![new_id, block_id, new_name, max_week + 1, max_order + 1],
        )
        .map_err(|e| format!("DB error: {}", e))?;

    // Copy microcycles
    let mut micro_stmt = app_state
        .db
        .prepare("SELECT name, day_number, notes, sort_order FROM microcycles WHERE mesocycle_id = ?1 ORDER BY sort_order")
        .map_err(|e| format!("DB error: {}", e))?;

    let microcycles: Vec<(String, i32, Option<String>, i32)> = micro_stmt
        .query_map(rusqlite::params![mesocycle_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .map_err(|e| format!("DB error: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("DB error: {}", e))?;

    for (micro_name, day_number, notes, sort_order) in &microcycles {
        let micro_id = Uuid::new_v4().to_string();
        app_state
            .db
            .execute(
                "INSERT INTO microcycles (id, mesocycle_id, name, day_number, notes, sort_order) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![micro_id, new_id, micro_name, day_number, notes, sort_order],
            )
            .map_err(|e| format!("DB error: {}", e))?;
    }

    Ok(serde_json::json!({ "id": new_id }))
}

#[tauri::command]
pub async fn save_microcycle_exercises(
    state: State<'_, Mutex<AppState>>,
    microcycle_id: String,
    exercises: Vec<ProgramExerciseInput>,
) -> Result<(), String> {
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    // Delete existing exercises (cascade deletes sets)
    app_state
        .db
        .execute(
            "DELETE FROM program_exercises WHERE microcycle_id = ?1",
            rusqlite::params![microcycle_id],
        )
        .map_err(|e| format!("DB error: {}", e))?;

    // Insert all exercises and sets
    for exercise in &exercises {
        let ex_id = Uuid::new_v4().to_string();
        app_state
            .db
            .execute(
                "INSERT INTO program_exercises (id, microcycle_id, exercise_template_id, sort_order, superset_group, rest_seconds, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![
                    ex_id,
                    microcycle_id,
                    exercise.exercise_template_id,
                    exercise.sort_order,
                    exercise.superset_group,
                    exercise.rest_seconds,
                    exercise.notes,
                ],
            )
            .map_err(|e| format!("DB error: {}", e))?;

        for set in &exercise.sets {
            let set_id = Uuid::new_v4().to_string();
            app_state
                .db
                .execute(
                    "INSERT INTO program_sets (id, program_exercise_id, sort_order, set_type, reps, rep_range_start, rep_range_end, weight_kg, percentage_of_tm, rpe_target, duration_seconds, distance_meters, custom_metric) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                    rusqlite::params![
                        set_id,
                        ex_id,
                        set.sort_order,
                        set.set_type,
                        set.reps,
                        set.rep_range_start,
                        set.rep_range_end,
                        set.weight_kg,
                        set.percentage_of_tm,
                        set.rpe_target,
                        set.duration_seconds,
                        set.distance_meters,
                        set.custom_metric,
                    ],
                )
                .map_err(|e| format!("DB error: {}", e))?;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn get_training_maxes(
    state: State<'_, Mutex<AppState>>,
    program_id: String,
) -> Result<Vec<TrainingMax>, String> {
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let mut stmt = app_state
        .db
        .prepare("SELECT id, exercise_template_id, program_id, estimated_1rm_kg, training_max_kg, tm_percentage_of_1rm, source, notes, created_at, updated_at FROM training_maxes WHERE program_id = ?1")
        .map_err(|e| format!("DB error: {}", e))?;

    let maxes = stmt
        .query_map(rusqlite::params![program_id], |row| {
            Ok(TrainingMax {
                id: row.get(0)?,
                exercise_template_id: row.get(1)?,
                program_id: row.get(2)?,
                estimated_1rm_kg: row.get(3)?,
                training_max_kg: row.get(4)?,
                tm_percentage_of_1rm: row.get(5)?,
                source: row.get(6)?,
                notes: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|e| format!("DB error: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("DB error: {}", e))?;

    Ok(maxes)
}

#[tauri::command]
pub async fn set_training_max(
    state: State<'_, Mutex<AppState>>,
    program_id: String,
    exercise_template_id: String,
    training_max_kg: f64,
    estimated_1rm_kg: Option<f64>,
    source: String,
) -> Result<TrainingMax, String> {
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let id = Uuid::new_v4().to_string();

    let tm_pct = estimated_1rm_kg
        .map(|e1rm| if e1rm > 0.0 { training_max_kg / e1rm } else { 0.9 })
        .unwrap_or(0.9);

    app_state
        .db
        .execute(
            "INSERT INTO training_maxes (id, exercise_template_id, program_id, estimated_1rm_kg, training_max_kg, tm_percentage_of_1rm, source) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT (exercise_template_id, program_id) DO UPDATE SET estimated_1rm_kg = ?4, training_max_kg = ?5, tm_percentage_of_1rm = ?6, source = ?7, updated_at = datetime('now')",
            rusqlite::params![id, exercise_template_id, program_id, estimated_1rm_kg, training_max_kg, tm_pct, source],
        )
        .map_err(|e| format!("DB error: {}", e))?;

    app_state
        .db
        .query_row(
            "SELECT id, exercise_template_id, program_id, estimated_1rm_kg, training_max_kg, tm_percentage_of_1rm, source, notes, created_at, updated_at FROM training_maxes WHERE exercise_template_id = ?1 AND program_id = ?2",
            rusqlite::params![exercise_template_id, program_id],
            |row| {
                Ok(TrainingMax {
                    id: row.get(0)?,
                    exercise_template_id: row.get(1)?,
                    program_id: row.get(2)?,
                    estimated_1rm_kg: row.get(3)?,
                    training_max_kg: row.get(4)?,
                    tm_percentage_of_1rm: row.get(5)?,
                    source: row.get(6)?,
                    notes: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            },
        )
        .map_err(|e| format!("DB error: {}", e))
}
