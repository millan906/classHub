-- Add is_released flag to grade_columns
-- Faculty control when students can see individual component scores.
-- Default false: scores are private until explicitly released.

ALTER TABLE public.grade_columns
  ADD COLUMN IF NOT EXISTS is_released boolean NOT NULL DEFAULT false;
