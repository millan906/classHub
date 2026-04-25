-- Migration 11: Fix entry_type constraint to include 'quiz_linked'
-- The code was inserting 'quiz' but the DB constraint only allowed ('manual', 'quiz_linked').
-- This expands the constraint and repairs any rows that were stored with the wrong value.

ALTER TABLE public.grade_columns
  DROP CONSTRAINT IF EXISTS grade_columns_entry_type_check;

ALTER TABLE public.grade_columns
  ADD CONSTRAINT grade_columns_entry_type_check
  CHECK (entry_type IN ('manual', 'quiz_linked'));

-- Repair any rows saved with the old wrong value 'quiz'
UPDATE public.grade_columns
  SET entry_type = 'quiz_linked'
  WHERE entry_type = 'quiz';
