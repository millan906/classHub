-- Migration 044: manually_overridden flag on grade_entries
-- Prevents the quiz sync from overwriting scores a faculty member has manually set.

ALTER TABLE public.grade_entries
  ADD COLUMN IF NOT EXISTS manually_overridden boolean NOT NULL DEFAULT false;
