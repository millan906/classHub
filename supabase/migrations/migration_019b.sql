-- Migration 19: Add randomize_questions to quizzes
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS randomize_questions boolean NOT NULL DEFAULT false;
