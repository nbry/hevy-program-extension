-- Add sync enhancements for bidirectional sync
-- Sync mode: entire program maps to one folder, or each block maps to its own folder
ALTER TABLE sync_records
    ADD COLUMN sync_mode text NOT NULL DEFAULT 'program' CHECK (sync_mode IN ('program', 'block'));

-- Track sync direction (pushed from app vs pulled/imported from Hevy)
ALTER TABLE sync_records
    ADD COLUMN sync_direction text NOT NULL DEFAULT 'push' CHECK (sync_direction IN ('push', 'pull'));

-- For block-as-folder mode: which block this sync_record maps to
ALTER TABLE sync_records
    ADD COLUMN block_id text REFERENCES blocks(id) ON DELETE CASCADE;

-- For block mode: allow multiple sync_records per program (one per block)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_records_block ON sync_records(program_id, block_id)
WHERE
    block_id IS NOT NULL;
