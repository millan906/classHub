-- Migration 054: Fix quiz_submissions faculty UPDATE policy
--
-- migration_042 broadened the UPDATE policy back to "any faculty can update
-- any submission" because migration_027's fix (scoped to quizzes.created_by)
-- silently blocked grading on admin-seeded quizzes where the quiz creator
-- is not the course instructor.
--
-- The correct scope is the course, not the quiz:
--   faculty must own the course the quiz belongs to
--   (courses.created_by = auth.uid())
--
-- Join path: quiz_submissions.quiz_id → quizzes.course_id → courses.created_by

DROP POLICY IF EXISTS "Faculty can update quiz submissions" ON public.quiz_submissions;

CREATE POLICY "Faculty can update quiz submissions for own courses"
  ON public.quiz_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.quizzes q
      JOIN public.courses c ON c.id = q.course_id
      WHERE q.id = quiz_submissions.quiz_id
        AND c.created_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'faculty'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.quizzes q
      JOIN public.courses c ON c.id = q.course_id
      WHERE q.id = quiz_submissions.quiz_id
        AND c.created_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'faculty'
        )
    )
  );
