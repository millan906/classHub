-- Migration 7: Allow category to be null so new group types
-- (Quizzes, Project, Exam) don't fail the old check constraint.
-- Phase 5 will drop category entirely.

alter table public.grade_columns
  alter column category drop not null;
