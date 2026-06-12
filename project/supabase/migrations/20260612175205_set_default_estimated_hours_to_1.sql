-- Set column default to 1 for future inserts
ALTER TABLE feedback_entries ALTER COLUMN estimated_fix_hours SET DEFAULT 1;

-- Backfill existing rows that have 0 or null
UPDATE feedback_entries
SET estimated_fix_hours = 1
WHERE estimated_fix_hours IS NULL OR estimated_fix_hours = 0;
