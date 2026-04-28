-- Students can view released grade columns for their enrolled courses.
-- Faculty access is already covered by the existing "Faculty manage grade columns"
-- FOR ALL policy. This adds a student-only SELECT path, gated on is_released = true
-- and course enrollment.

CREATE POLICY "Students can view released grade columns"
  ON public.grade_columns FOR SELECT
  USING (
    is_released = true
    AND course_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.course_enrollments ce
      WHERE ce.course_id::text = grade_columns.course_id::text
        AND ce.student_id = auth.uid()
    )
  );
