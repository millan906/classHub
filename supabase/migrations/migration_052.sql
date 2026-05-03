-- Migration 052: Allow faculty to read all course enrollments
--
-- The existing policy only allows faculty to read enrollments they personally created
-- (invited_by = auth.uid()). This blocks course-scoped Q&A filtering and student
-- audience pickers from working correctly for any faculty who didn't enroll the students.

CREATE POLICY "Faculty can read all enrollments"
  ON public.course_enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'faculty'
    )
  );
