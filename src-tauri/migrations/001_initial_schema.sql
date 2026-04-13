-- Initial schema for Hevy Program Extension
-- All weights stored in kg internally
PRAGMA journal_mode = WAL;

PRAGMA foreign_keys = ON;

-- User settings (singleton row)
CREATE TABLE IF NOT EXISTS settings(
    id integer PRIMARY KEY CHECK (id = 1),
    unit_system text NOT NULL DEFAULT 'metric' CHECK (unit_system IN ('metric', 'imperial')),
    hevy_user_id text,
    hevy_username text,
    exercise_cache_updated_at text,
    created_at text NOT NULL DEFAULT (datetime('now')),
    updated_at text NOT NULL DEFAULT (datetime('now'))
);

INSERT
    OR IGNORE INTO settings(id)
        VALUES (1);

-- Cached exercise templates from Hevy API
CREATE TABLE IF NOT EXISTS exercise_templates(
    id text PRIMARY KEY,
    title text NOT NULL,
    exercise_type text NOT NULL,
    primary_muscle_group text NOT NULL,
    secondary_muscle_groups text,
    equipment text,
    is_custom integer NOT NULL DEFAULT 0,
    cached_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_exercise_templates_title ON exercise_templates(title);

-- Training programs
CREATE TABLE IF NOT EXISTS programs(
    id text PRIMARY KEY,
    name text NOT NULL,
    description text,
    created_at text NOT NULL DEFAULT (datetime('now')),
    updated_at text NOT NULL DEFAULT (datetime('now'))
);

-- Training blocks within a program
CREATE TABLE IF NOT EXISTS blocks(
    id text PRIMARY KEY,
    program_id text NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    name text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    created_at text NOT NULL DEFAULT (datetime('now')),
    updated_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_blocks_program ON blocks(program_id);

-- Mesocycles (weeks) within a block
CREATE TABLE IF NOT EXISTS mesocycles(
    id text PRIMARY KEY,
    block_id text NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    name text NOT NULL,
    week_number integer NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    created_at text NOT NULL DEFAULT (datetime('now')),
    updated_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mesocycles_block ON mesocycles(block_id);

-- Microcycles (training days) within a mesocycle
CREATE TABLE IF NOT EXISTS microcycles(
    id text PRIMARY KEY,
    mesocycle_id text NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
    name text NOT NULL,
    day_number integer NOT NULL,
    notes text,
    sort_order integer NOT NULL DEFAULT 0,
    created_at text NOT NULL DEFAULT (datetime('now')),
    updated_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_microcycles_mesocycle ON microcycles(mesocycle_id);

-- Exercises within a microcycle
CREATE TABLE IF NOT EXISTS program_exercises(
    id text PRIMARY KEY,
    microcycle_id text NOT NULL REFERENCES microcycles(id) ON DELETE CASCADE,
    exercise_template_id text NOT NULL REFERENCES exercise_templates(id),
    sort_order integer NOT NULL DEFAULT 0,
    superset_group integer,
    rest_seconds integer,
    notes text,
    created_at text NOT NULL DEFAULT (datetime('now')),
    updated_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_program_exercises_microcycle ON program_exercises(microcycle_id);

-- Sets within a program exercise
CREATE TABLE IF NOT EXISTS program_sets(
    id text PRIMARY KEY,
    program_exercise_id text NOT NULL REFERENCES program_exercises(id) ON DELETE CASCADE,
    sort_order integer NOT NULL DEFAULT 0,
    set_type text NOT NULL DEFAULT 'normal' CHECK (set_type IN ('warmup', 'normal', 'failure', 'dropset')),
    reps integer,
    rep_range_start integer,
    rep_range_end integer,
    weight_kg real,
    percentage_of_tm real,
    rpe_target real,
    duration_seconds integer,
    distance_meters integer,
    custom_metric real,
    created_at text NOT NULL DEFAULT (datetime('now')),
    updated_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_program_sets_exercise ON program_sets(program_exercise_id);

-- Training maxes per exercise per program
CREATE TABLE IF NOT EXISTS training_maxes(
    id text PRIMARY KEY,
    exercise_template_id text NOT NULL REFERENCES exercise_templates(id),
    program_id text NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    estimated_1rm_kg real,
    training_max_kg real NOT NULL,
    tm_percentage_of_1rm real DEFAULT 0.9,
    source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'hevy_import', 'calculated')),
    notes text,
    created_at text NOT NULL DEFAULT (datetime('now')),
    updated_at text NOT NULL DEFAULT (datetime('now')),
    UNIQUE (exercise_template_id, program_id)
);

CREATE INDEX IF NOT EXISTS idx_training_maxes_program ON training_maxes(program_id);

-- Sync tracking per program
CREATE TABLE IF NOT EXISTS sync_records(
    id text PRIMARY KEY,
    program_id text NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    hevy_folder_id integer,
    hevy_folder_title text,
    last_synced_at text,
    sync_status text NOT NULL DEFAULT 'never' CHECK (sync_status IN ('never', 'synced', 'modified', 'error')),
    created_at text NOT NULL DEFAULT (datetime('now')),
    updated_at text NOT NULL DEFAULT (datetime('now')),
    UNIQUE (program_id)
);

-- Individual routine sync tracking
CREATE TABLE IF NOT EXISTS synced_routines(
    id text PRIMARY KEY,
    sync_record_id text NOT NULL REFERENCES sync_records(id) ON DELETE CASCADE,
    microcycle_id text NOT NULL REFERENCES microcycles(id) ON DELETE CASCADE,
    hevy_routine_id text,
    last_synced_at text,
    sync_status text NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'modified', 'error')),
    error_message text,
    created_at text NOT NULL DEFAULT (datetime('now')),
    updated_at text NOT NULL DEFAULT (datetime('now')),
    UNIQUE (microcycle_id)
);

CREATE INDEX IF NOT EXISTS idx_synced_routines_sync_record ON synced_routines(sync_record_id);
