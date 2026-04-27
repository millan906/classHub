-- Migration 035: Performance indexes
--
-- quiz_submissions and course_enrollments are the two most-queried join tables.
-- These indexes cover the foreign-key lookups that fire on every GradeBook load,
-- quiz fetch, and enrollment check.

CREATE INDEX IF NOT EXISTS idx_course_enrollments_course_id
  ON public.course_enrollments(course_id);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_student_id
  ON public.course_enrollments(student_id);

CREATE INDEX IF NOT EXISTS idx_quiz_submissions_quiz_id
  ON public.quiz_submissions(quiz_id);

CREATE INDEX IF NOT EXISTS idx_quiz_submissions_student_id
  ON public.quiz_submissions(student_id);
