-- Migration 20: Add file_max_points to quizzes for file-submission assignments
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS file_max_points integer;
