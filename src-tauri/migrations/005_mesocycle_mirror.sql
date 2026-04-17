-- Add mirror_of column to mesocycles table
-- When set, this mesocycle is a "live mirror" of the referenced mesocycle
-- and will not be synced to Hevy (only the source is synced)
ALTER TABLE mesocycles
    ADD COLUMN mirror_of TEXT REFERENCES mesocycles(id) ON DELETE SET NULL;
