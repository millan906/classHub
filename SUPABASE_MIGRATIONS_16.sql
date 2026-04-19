-- Migration 16: Registrar architecture foundation (placeholder)
-- Adds section/program to student profiles and course_faculty assignment table.
-- All changes are additive and non-breaking — existing data is untouched.

-- Add program (e.g. "BSIT") and section (e.g. "3C") to profiles.
-- Nullable: existing students and all faculty rows stay as NULL.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS program text,
  ADD COLUMN IF NOT EXISTS section text;

-- course_faculty: maps which faculty member is assigned to which course.
-- Placeholder for future registrar-controlled assignment.
-- Currently unused in UI — structure is ready for when the registrar role is built.
CREATE TABLE IF NOT EXISTS public.course_faculty (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  faculty_id  uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(course_id, faculty_id)
);

ALTER TABLE public.course_faculty ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view course_faculty"
  ON public.course_faculty FOR SELECT TO authenticated USING (true);

CREATE POLICY "Faculty can manage own course_faculty"
  ON public.course_faculty FOR ALL TO authenticated
  USING (faculty_id = auth.uid())
  WITH CHECK (faculty_id = auth.uid());
