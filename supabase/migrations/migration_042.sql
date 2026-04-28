-- Migration 042: Broaden quiz_submissions UPDATE policy for faculty grading
--
-- migration_027 scoped faculty UPDATE to only their own quizzes (created_by = auth.uid()).
-- In practice this silently blocks grading on any quiz NOT created by the logged-in
-- faculty user (e.g. quizzes seeded by an admin, or viewed by a co-instructor).
-- The SELECT policy already grants all faculty read access to all submissions, so
-- restricting UPDATE more narrowly than SELECT creates an invisible, silent failure.
--
-- Restoring the original intent: any faculty member can grade any submission.

DROP POLICY IF EXISTS "Faculty can update own quiz submissions" ON public.quiz_submissions;

CREATE POLICY "Faculty can update quiz submissions"
  ON public.quiz_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'faculty'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'faculty'
    )
  );
