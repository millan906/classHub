-- Migration 056: Scope profiles SELECT — safe rewrite
--
-- migration_055 used get_my_role() (SECURITY DEFINER) to determine the
-- caller's role inside the policy. This caused sign-in to break: during
-- session initialisation get_my_role() can return NULL, making all scoped
-- policies return false and leaving fetchProfile with 0 rows.
--
-- This rewrite avoids get_my_role() and get_my_institution_id() entirely.
-- Role is determined via institution_members (no profiles recursion).
--
-- Policies:
--   1. Own profile      — auth.uid() = id  (always safe, covers sign-in)
--   2. Faculty / Admin  — caller has faculty or admin row in institution_members
--                         AND target profile is in the same institution
--   3. Students         — caller is a student in institution_members
--                         AND target is faculty in same institution
--                         OR target is a classmate (shared course_enrollment)

-- ── Drop current broad policy restored by rollback ───────────────────────────

DROP POLICY IF EXISTS "Authenticated users can read profiles"   ON public.profiles;

-- ── Drop any leftovers from prior attempts ───────────────────────────────────

DROP POLICY IF EXISTS "Users can read all profiles"             ON public.profiles;
DROP POLICY IF EXISTS "Users can read institution profiles"     ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile"              ON public.profiles;
DROP POLICY IF EXISTS "Faculty can read institution profiles"   ON public.profiles;
DROP POLICY IF EXISTS "Students can read relevant profiles"     ON public.profiles;
DROP POLICY IF EXISTS "Admins can read institution profiles"    ON public.profiles;
DROP POLICY IF EXISTS "Faculty and admins can read profiles"    ON public.profiles;

-- ── 1. Own profile (covers useAuth fetchProfile, avatar updates) ─────────────

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- ── 2. Faculty + Admins: all profiles in same institution ────────────────────
--    Uses institution_members — no profiles self-join, no recursion risk.
--    Covers: useStudents, useCourseFaculty, GradeBook, Q&A poster join.

CREATE POLICY "Faculty and admins can read institution profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.institution_members im
      WHERE im.user_id = auth.uid()
        AND im.role IN ('faculty', 'admin')
        AND im.institution_id = profiles.institution_id
    )
  );

-- ── 3. Students: faculty in same institution + enrolled classmates ───────────
--    Blocks reading other students' email/student_no/program/section
--    across courses they are not enrolled in.

CREATE POLICY "Students can read relevant profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.institution_members im
      WHERE im.user_id = auth.uid()
        AND im.role = 'student'
        AND im.institution_id = profiles.institution_id
    )
    AND (
      -- target is faculty (needed for Q&A author display, announcements)
      profiles.role = 'faculty'
      -- target is a classmate sharing at least one enrolled course
      OR EXISTS (
        SELECT 1
        FROM public.course_enrollments e1
        JOIN public.course_enrollments e2 ON e1.course_id = e2.course_id
        WHERE e1.student_id = auth.uid()
          AND e2.student_id = profiles.id
      )
    )
  );
