-- Migration 050: Add reason field to quiz_exceptions
-- Lets faculty document why a student was granted an extra attempt (e.g. medical, technical issue).

ALTER TABLE public.quiz_exceptions
  ADD COLUMN IF NOT EXISTS reason text;
