-- Migration 8: Add description column to grade_columns
-- Stores instructions/content for Lab, Assignment, Project, Exam entries.

alter table public.grade_columns
  add column if not exists description text;
