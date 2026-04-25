-- ============================================================
-- Migration 25: Per-course grade group isolation
-- ============================================================

-- Step 1: Create per-course groups by copying global group structure.
INSERT INTO public.grade_groups (name, weight_percent, created_by, course_id)
SELECT gg.name, gg.weight_percent, c.created_by, c.id
FROM public.courses c
JOIN public.grade_groups gg
  ON gg.created_by = c.created_by
  AND gg.course_id IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.grade_groups ex
  WHERE ex.course_id::text = c.id::text
    AND ex.created_by = c.created_by
    AND LOWER(ex.name) = LOWER(gg.name)
);

-- Step 2: Re-point quizzes from global group → their course's group.
UPDATE public.quizzes q
SET grade_group_id = cgg.id
FROM public.grade_groups cgg
JOIN public.grade_groups ggg
  ON LOWER(ggg.name) = LOWER(cgg.name)
  AND ggg.course_id IS NULL
  AND ggg.created_by = cgg.created_by
WHERE q.course_id IS NOT NULL
  AND cgg.course_id::text = q.course_id::text
  AND cgg.created_by = q.created_by
  AND q.grade_group_id = ggg.id;

-- Step 3: Re-point grade_columns (with known course_id) from global → per-course group.
UPDATE public.grade_columns gc
SET group_id = cgg.id
FROM public.grade_groups cgg
JOIN public.grade_groups ggg
  ON LOWER(ggg.name) = LOWER(cgg.name)
  AND ggg.course_id IS NULL
  AND ggg.created_by = cgg.created_by
WHERE gc.course_id IS NOT NULL
  AND cgg.course_id::text = gc.course_id::text
  AND cgg.created_by = gc.created_by
  AND gc.group_id = ggg.id;

-- Step 4: Backfill course_id + group_id on quiz-linked columns that still have course_id = NULL.
UPDATE public.grade_columns gc
SET
  course_id = q.course_id,
  group_id  = cgg.id
FROM public.quizzes q
JOIN public.grade_groups cgg
  ON cgg.course_id::text = q.course_id::text
  AND cgg.created_by = q.created_by
JOIN public.grade_groups ggg
  ON LOWER(ggg.name) = LOWER(cgg.name)
  AND ggg.course_id IS NULL
WHERE gc.linked_quiz_id = q.id
  AND gc.course_id IS NULL
  AND q.course_id IS NOT NULL
  AND ggg.id = gc.group_id;
