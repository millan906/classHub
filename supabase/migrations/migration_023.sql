-- ============================================================
-- Migration 23: Drop grade_groups unique(created_by, name) constraint
-- The constraint was created when groups were global per-faculty.
-- Now that groups are course-scoped (course_id added in migration 22),
-- different courses need to be able to share group names (e.g. "Quizzes").
-- The INSERT was silently failing for anyone trying to add a per-course
-- group whose name already existed as a global default group.
-- Safe to run while live — only removes a constraint, no data changes.
-- ============================================================

ALTER TABLE public.grade_groups
  DROP CONSTRAINT IF EXISTS grade_groups_created_by_name_key;
