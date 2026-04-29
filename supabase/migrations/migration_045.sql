-- Migration 045: Backfill grade_columns.course_id from linked quiz
-- Enforces course isolation: every quiz-linked column should carry the quiz's course_id.

UPDATE public.grade_columns gc
SET course_id = q.course_id
FROM public.quizzes q
WHERE gc.linked_quiz_id = q.id
  AND gc.course_id IS NULL
  AND q.course_id IS NOT NULL;
