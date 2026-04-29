-- Migration 046: quiz_exceptions — per-student attempt grants
-- Lets faculty reopen an assessment for a specific student without affecting the whole class.

CREATE TABLE IF NOT EXISTS public.quiz_exceptions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id     uuid        NOT NULL REFERENCES public.quizzes(id)   ON DELETE CASCADE,
  student_id  uuid        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  extra_attempts integer  NOT NULL DEFAULT 1 CHECK (extra_attempts >= 1),
  granted_by  uuid        NOT NULL REFERENCES public.profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, student_id)
);

ALTER TABLE public.quiz_exceptions ENABLE ROW LEVEL SECURITY;

-- Faculty: full read/write
CREATE POLICY "Faculty can manage quiz exceptions"
  ON public.quiz_exceptions
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'faculty')
  );

-- Students: read their own exceptions so the client can compute effective max_attempts
CREATE POLICY "Students can view own exceptions"
  ON public.quiz_exceptions FOR SELECT
  USING (auth.uid() = student_id);
