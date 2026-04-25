-- ============================================================
-- Migration 24: Wire unlinked quizzes to grade groups
--
-- Step 1: Ensure global grade groups exist for every faculty.
--   (Migration 6 seeded these, but faculty who joined later may not have them.)
--
-- Step 2: Set grade_group_id on quizzes that have no group assigned,
--   matching by item_type → group name. This lets syncQuizScores and
--   syncToGradebook pick them up automatically.
--
-- Safe to run while live:
--   - INSERT uses ON CONFLICT DO NOTHING (idempotent)
--   - UPDATE only touches rows where grade_group_id IS NULL
-- ============================================================

-- Step 1: Create global groups for any faculty that doesn't have them
INSERT INTO public.grade_groups (name, weight_percent, created_by)
SELECT g.name, g.weight_percent, p.id
FROM public.profiles p
CROSS JOIN (VALUES
  ('Quizzes',     15),
  ('Laboratory',  25),
  ('Assignments', 20),
  ('Project',     15),
  ('Exam',        25)
) AS g(name, weight_percent)
WHERE p.role = 'faculty'
  AND NOT EXISTS (
    SELECT 1 FROM public.grade_groups gg
    WHERE gg.created_by = p.id
      AND gg.course_id IS NULL
      AND LOWER(gg.name) = LOWER(g.name)
  );

-- Step 2: Link unlinked quizzes to the matching global group
UPDATE public.quizzes q
SET grade_group_id = gg.id
FROM public.grade_groups gg
WHERE q.grade_group_id IS NULL
  AND q.created_by = gg.created_by
  AND gg.course_id IS NULL
  AND LOWER(gg.name) = CASE LOWER(q.item_type)
    WHEN 'quiz'       THEN 'quizzes'
    WHEN 'lab'        THEN 'laboratory'
    WHEN 'assignment' THEN 'assignments'
    WHEN 'project'    THEN 'project'
    WHEN 'exam'       THEN 'exam'
    WHEN 'activity'   THEN 'activities'
    ELSE ''
  END;
