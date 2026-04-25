-- Migration 10: Add essay question type + essay scores on submissions

-- Allow 'essay' as a valid question type (drops and recreates the check constraint)
ALTER TABLE public.quiz_questions
  DROP CONSTRAINT IF EXISTS quiz_questions_type_check;

ALTER TABLE public.quiz_questions
  ADD CONSTRAINT quiz_questions_type_check
  CHECK (type IN ('mcq', 'truefalse', 'codesnippet', 'essay'));

-- Store faculty-assigned essay scores per question (question_id -> points)
ALTER TABLE public.quiz_submissions
  ADD COLUMN IF NOT EXISTS essay_scores jsonb DEFAULT '{}';

-- Allow faculty to update submissions (needed for essay grading: earned_points, score, essay_scores)
CREATE POLICY "Faculty can update submissions for grading"
  ON public.quiz_submissions
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'faculty')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'faculty')
  );
