-- Migration 043: Add course_name to notifications for explicit subject display

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS course_name text;
