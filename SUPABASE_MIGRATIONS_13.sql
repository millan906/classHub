-- Migration 13: Add first_name and last_name to profiles

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name  TEXT NOT NULL DEFAULT '';

-- Backfill existing rows by splitting full_name on the first space
UPDATE profiles
SET
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name  = TRIM(SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1))
WHERE full_name <> '';

-- Remove the defaults now that existing rows are backfilled
ALTER TABLE profiles
  ALTER COLUMN first_name DROP DEFAULT,
  ALTER COLUMN last_name  DROP DEFAULT;
