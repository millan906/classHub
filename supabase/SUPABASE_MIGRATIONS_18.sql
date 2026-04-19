-- Migration 18: Student number + pending roster for auto-enrollment

-- Add student_no to profiles (nullable — existing users unaffected)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS student_no text;

CREATE INDEX IF NOT EXISTS profiles_student_no_idx ON public.profiles(student_no);

-- pending_roster: stores class list entries uploaded before students register.
-- When a student registers with a matching student_no, they are auto-enrolled.
CREATE TABLE IF NOT EXISTS public.pending_roster (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_no  text NOT NULL,
  course_id   uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  last_name   text,
  first_name  text,
  uploaded_by uuid REFERENCES public.profiles(id),
  created_at  timestamptz DEFAULT now(),
  UNIQUE(student_no, course_id)
);

ALTER TABLE public.pending_roster ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage pending_roster"
  ON public.pending_roster FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
