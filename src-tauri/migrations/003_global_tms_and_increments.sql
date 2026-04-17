-- Global training maxes (not scoped to a program)
CREATE TABLE IF NOT EXISTS global_training_maxes(
    id text PRIMARY KEY,
    exercise_template_id text NOT NULL UNIQUE REFERENCES exercise_templates(id),
    estimated_1rm_kg real,
    training_max_kg real NOT NULL,
    tm_percentage_of_1rm real DEFAULT 0.9,
    source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'hevy_import', 'calculated')),
    notes text,
    created_at text NOT NULL DEFAULT (datetime('now')),
    updated_at text NOT NULL DEFAULT (datetime('now'))
);

-- Per-equipment-type minimum weight increments (JSON map), stored in kg
ALTER TABLE settings
    ADD COLUMN minimum_increments_kg text NOT NULL DEFAULT '{"barbell":2.5,"dumbbell":2.0,"machine":5.0,"kettlebell":4.0,"plate":2.5,"other":2.5,"none":0,"resistance_band":0,"suspension":0}';

-- Fallback increment when equipment is unknown, stored in kg
ALTER TABLE settings
    ADD COLUMN default_increment_kg real NOT NULL DEFAULT 2.5;
