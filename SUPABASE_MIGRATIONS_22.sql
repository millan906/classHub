-- ============================================================
-- Migration 22: Add course_id to grade_groups and grade_columns
-- Safe to run while live — ALTER TABLE ADD COLUMN is non-destructive.
-- Existing rows get NULL, which the app already handles correctly.
-- ============================================================

ALTER TABLE public.grade_groups
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;

ALTER TABLE public.grade_columns
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;
