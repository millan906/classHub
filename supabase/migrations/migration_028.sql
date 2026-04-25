-- Migration 028: MEDIUM priority RLS fixes
-- Scope courses, quizzes, announcements, grade_groups, grade_columns SELECT
-- to enrolled students only — replaces broad "auth.role() = 'authenticated'" policies.
--
-- Pattern for each table:
--   Faculty  → access via existing FOR ALL policy (own rows) — no change needed
--   Students → can only SELECT rows belonging to courses they are enrolled in
--   NULL course_id rows → treated as global; faculty-only (students cannot see them
--                         directly, but they are not student-facing data anyway)

-- ─── courses ─────────────────────────────────────────────────────────────────
-- Faculty SELECT is already covered by "Faculty can manage own courses" (FOR ALL).
-- Students should only see courses they are enrolled in.

DROP POLICY IF EXISTS "Authenticated users can view courses" ON public.courses;

CREATE POLICY "Students can view enrolled courses"
  ON public.courses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.course_enrollments ce
      WHERE ce.course_id = courses.id
        AND ce.student_id = auth.uid()
    )
  );

-- ─── quizzes ──────────────────────────────────────────────────────────────────
-- Faculty SELECT is already covered by "Faculty manage own quizzes" (FOR ALL).
-- Students should only see quizzes for courses they are enrolled in.
-- Quizzes with course_id IS NULL are legacy/global — not student-facing, skip them.

DROP POLICY IF EXISTS "Authenticated users can view quizzes" ON public.quizzes;

CREATE POLICY "Students can view enrolled course quizzes"
  ON public.quizzes FOR SELECT
  USING (
    quizzes.course_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.course_enrollments ce
      WHERE ce.course_id = quizzes.course_id
        AND ce.student_id = auth.uid()
    )
  );

-- ─── announcements ────────────────────────────────────────────────────────────
-- Faculty SELECT is already covered by "Faculty manage own announcements" (FOR ALL).
-- Students should only see announcements for courses they are enrolled in.

DROP POLICY IF EXISTS "Authenticated users can view announcements" ON public.announcements;

CREATE POLICY "Students can view enrolled course announcements"
  ON public.announcements FOR SELECT
  USING (
    announcements.course_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.course_enrollments ce
      WHERE ce.course_id = announcements.course_id
        AND ce.student_id = auth.uid()
    )
  );

-- ─── grade_groups ─────────────────────────────────────────────────────────────
-- Faculty SELECT is already covered by "Faculty manage own groups" (FOR ALL).
-- Students do not interact with grade_groups directly (grade view goes through
-- grade_entries). Dropping the broad policy; no student SELECT policy added.

DROP POLICY IF EXISTS "Authenticated read groups" ON public.grade_groups;

-- ─── grade_columns ────────────────────────────────────────────────────────────
-- Faculty SELECT is already covered by "Faculty manage grade columns" (FOR ALL).
-- Students do not query grade_columns directly. Dropping the broad policy.

DROP POLICY IF EXISTS "Authenticated read grade columns" ON public.grade_columns;
