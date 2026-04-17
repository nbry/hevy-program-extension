use rusqlite::Connection;
use std::path::Path;

const MIGRATION_SQL: &str = include_str!("../../migrations/001_initial_schema.sql");
const MIGRATION_002_SQL: &str = include_str!("../../migrations/002_add_zoom_level.sql");
const MIGRATION_003_SQL: &str = include_str!("../../migrations/003_global_tms_and_increments.sql");
const MIGRATION_004_SQL: &str = include_str!("../../migrations/004_sync_enhancements.sql");

pub fn run_migrations(db: &Connection) -> Result<(), String> {
    // Check if migration has been applied
    db.execute_batch("CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now')));")
        .map_err(|e| format!("Failed to create migrations table: {}", e))?;

    let applied: bool = db
        .query_row(
            "SELECT COUNT(*) > 0 FROM _migrations WHERE name = '001_initial_schema'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !applied {
        db.execute_batch(MIGRATION_SQL)
            .map_err(|e| format!("Migration failed: {}", e))?;

        db.execute(
            "INSERT INTO _migrations (name) VALUES ('001_initial_schema')",
            [],
        )
        .map_err(|e| format!("Failed to record migration: {}", e))?;

        log::info!("Applied migration: 001_initial_schema");
    }

    let applied_002: bool = db
        .query_row(
            "SELECT COUNT(*) > 0 FROM _migrations WHERE name = '002_add_zoom_level'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !applied_002 {
        db.execute_batch(MIGRATION_002_SQL)
            .map_err(|e| format!("Migration 002 failed: {}", e))?;

        db.execute(
            "INSERT INTO _migrations (name) VALUES ('002_add_zoom_level')",
            [],
        )
        .map_err(|e| format!("Failed to record migration: {}", e))?;

        log::info!("Applied migration: 002_add_zoom_level");
    }

    let applied_003: bool = db
        .query_row(
            "SELECT COUNT(*) > 0 FROM _migrations WHERE name = '003_global_tms_and_increments'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !applied_003 {
        db.execute_batch(MIGRATION_003_SQL)
            .map_err(|e| format!("Migration 003 failed: {}", e))?;

        db.execute(
            "INSERT INTO _migrations (name) VALUES ('003_global_tms_and_increments')",
            [],
        )
        .map_err(|e| format!("Failed to record migration: {}", e))?;

        log::info!("Applied migration: 003_global_tms_and_increments");
    }

    let applied_004: bool = db
        .query_row(
            "SELECT COUNT(*) > 0 FROM _migrations WHERE name = '004_sync_enhancements'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !applied_004 {
        db.execute_batch(MIGRATION_004_SQL)
            .map_err(|e| format!("Migration 004 failed: {}", e))?;

        db.execute(
            "INSERT INTO _migrations (name) VALUES ('004_sync_enhancements')",
            [],
        )
        .map_err(|e| format!("Failed to record migration: {}", e))?;

        log::info!("Applied migration: 004_sync_enhancements");
    }

    Ok(())
}

pub fn open_database(app_data_dir: &Path) -> Result<Connection, String> {
    std::fs::create_dir_all(app_data_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    let db_path = app_data_dir.join("hevy_programs.db");
    let db = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("Failed to set pragmas: {}", e))?;

    run_migrations(&db)?;

    log::info!("Database opened at {:?}", db_path);
    Ok(db)
}
