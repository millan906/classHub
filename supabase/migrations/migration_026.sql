-- ============================================================
-- Migration 26: Fix cross-course group_id references
--
-- Root cause: quiz-linked grade_columns for courses other than
-- BSIT 3C have group_id pointing to BSIT 3C's course-specific
-- "Quizzes" group. When those courses are filtered, that group
-- is not returned, so visibleGroups is empty → nothing renders.
--
-- Fix: re-point each column's group_id to the matching group
-- for its own course (created in migration 25).
-- ============================================================

-- Step 1: Fix quizzes whose grade_group_id points to a different
-- course's group. Re-point to their own course's matching group.
UPDATE public.quizzes q
SET grade_group_id = correct.id
FROM public.grade_groups wrong,
     public.grade_groups correct
WHERE q.grade_group_id = wrong.id
  AND q.course_id IS NOT NULL
  AND (wrong.course_id IS NULL OR wrong.course_id::text != q.course_id::text)
  AND LOWER(correct.name) = LOWER(wrong.name)
  AND correct.course_id::text = q.course_id::text
  AND correct.created_by = q.created_by;

-- Step 2: Fix grade_columns whose group_id points to a different
-- course's group. Derive correct group from the linked quiz's course.
UPDATE public.grade_columns gc
SET group_id = correct.id
FROM public.quizzes q,
     public.grade_groups wrong,
     public.grade_groups correct
WHERE gc.linked_quiz_id = q.id
  AND gc.group_id = wrong.id
  AND q.course_id IS NOT NULL
  AND (wrong.course_id IS NULL OR wrong.course_id::text != q.course_id::text)
  AND LOWER(correct.name) = LOWER(wrong.name)
  AND correct.course_id::text = q.course_id::text
  AND correct.created_by = q.created_by;

-- Step 3: Also fix course_id on columns that are still NULL
-- but belong to a quiz with a known course.
UPDATE public.grade_columns gc
SET course_id = q.course_id
FROM public.quizzes q
WHERE gc.linked_quiz_id = q.id
  AND gc.course_id IS NULL
  AND q.course_id IS NOT NULL;
