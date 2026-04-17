mod commands;
mod db;
mod hevy;
mod models;
mod utils;

use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub db: rusqlite::Connection,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialize database
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");

            let db = db::migrations::open_database(&app_data_dir)
                .expect("Failed to initialize database");

            app.manage(Mutex::new(AppState { db }));

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // API Key
            commands::api_key::validate_api_key,
            commands::api_key::store_api_key,
            commands::api_key::get_api_key,
            commands::api_key::remove_api_key,
            // Settings
            commands::settings::get_settings,
            commands::settings::update_settings,
            // Hevy API
            commands::hevy_api::sync_exercise_templates,
            commands::hevy_api::get_exercise_templates,
            commands::hevy_api::search_exercises,
            commands::hevy_api::calculate_1rm_from_history,
            // Program
            commands::program::create_program,
            commands::program::get_programs,
            commands::program::get_program,
            commands::program::update_program,
            commands::program::delete_program,
            commands::program::duplicate_program,
            commands::program::add_block,
            commands::program::add_mesocycle,
            commands::program::add_microcycle,
            commands::program::rename_block,
            commands::program::rename_mesocycle,
            commands::program::rename_microcycle,
            commands::program::reorder_blocks,
            commands::program::reorder_mesocycles,
            commands::program::reorder_microcycles,
            commands::program::delete_block,
            commands::program::delete_mesocycle,
            commands::program::delete_microcycle,
            commands::program::duplicate_mesocycle,
            commands::program::save_microcycle_exercises,
            commands::program::get_training_maxes,
            commands::program::set_training_max,
            commands::program::delete_training_max,
            // Global Training Maxes
            commands::program::get_global_training_maxes,
            commands::program::set_global_training_max,
            commands::program::delete_global_training_max,
            // Exercise equipment
            commands::program::update_exercise_equipment,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
