-- Prevent duplicate grade_columns for the same linked quiz.
-- Concurrent GradeBook sync runs could both INSERT when they find no existing
-- row, producing duplicates. The unique constraint stops that at the DB level.
--
-- First, deduplicate any existing duplicates by keeping the oldest row per quiz.
DELETE FROM public.grade_columns
WHERE id NOT IN (
  SELECT DISTINCT ON (linked_quiz_id) id
  FROM public.grade_columns
  WHERE linked_quiz_id IS NOT NULL
  ORDER BY linked_quiz_id, created_at ASC
)
AND linked_quiz_id IS NOT NULL;

-- Now enforce uniqueness going forward.
ALTER TABLE public.grade_columns
  ADD CONSTRAINT grade_columns_linked_quiz_id_unique
  UNIQUE (linked_quiz_id);
