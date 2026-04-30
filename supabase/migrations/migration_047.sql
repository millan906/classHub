-- Migration 047: quiz_feedback — per-student faculty feedback on file/activity assessments

CREATE TABLE IF NOT EXISTS public.quiz_feedback (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id     uuid        NOT NULL REFERENCES public.quizzes(id)  ON DELETE CASCADE,
  student_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feedback    text        NOT NULL DEFAULT '',
  updated_by  uuid        REFERENCES public.profiles(id),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, student_id)
);

ALTER TABLE public.quiz_feedback ENABLE ROW LEVEL SECURITY;

-- Faculty: full read/write
CREATE POLICY "Faculty can manage quiz feedback"
  ON public.quiz_feedback
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'faculty')
  );

-- Students: read their own feedback
CREATE POLICY "Students can view own feedback"
  ON public.quiz_feedback FOR SELECT
  USING (auth.uid() = student_id);
