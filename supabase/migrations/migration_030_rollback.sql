-- Migration 030: ROLLBACK migrations 027, 028, 029
-- Restores all original broad policies so login and access work again.

-- ─── profiles ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Faculty can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Students can read relevant profiles" ON public.profiles;
DROP FUNCTION IF EXISTS public.get_my_role();

CREATE POLICY "Authenticated users can read profiles"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- ─── quiz_submissions (keep fix #6 — it was correct and non-breaking) ────────
-- No change. "Faculty can update own quiz submissions" stays.

-- ─── courses ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Students can view enrolled courses" ON public.courses;

CREATE POLICY "Authenticated users can view courses"
  ON public.courses FOR SELECT
  USING (auth.role() = 'authenticated');

-- ─── quizzes ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Students can view enrolled course quizzes" ON public.quizzes;

CREATE POLICY "Authenticated users can view quizzes"
  ON public.quizzes FOR SELECT
  USING (auth.role() = 'authenticated');

-- ─── announcements ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Students can view enrolled course announcements" ON public.announcements;

CREATE POLICY "Authenticated users can view announcements"
  ON public.announcements FOR SELECT
  USING (auth.role() = 'authenticated');

-- ─── grade_groups ─────────────────────────────────────────────────────────────
CREATE POLICY "Authenticated read groups"
  ON public.grade_groups FOR SELECT
  USING (auth.role() = 'authenticated');

-- ─── grade_columns ────────────────────────────────────────────────────────────
CREATE POLICY "Authenticated read grade columns"
  ON public.grade_columns FOR SELECT
  USING (auth.role() = 'authenticated');
