-- Migration 036: Scope profiles SELECT to institution + enrollment
--
-- Problem: "Authenticated users can read profiles" lets any logged-in user
-- read every profile in the database — across all institutions.
--
-- Fix: institution-scoped policies per role, using SECURITY DEFINER helper
-- functions to avoid the infinite-recursion error that caused migration_029
-- to be rolled back (querying public.profiles inside a profiles RLS policy
-- re-triggers the policy on the same table).
--
-- Faculty  → all profiles in same institution (needed for student approval flow)
-- Students → own profile + faculty in their institution + enrolled classmates
-- Admins   → all profiles in their institution (checked via institution_members)
-- Everyone → always their own profile

-- ── Helper functions (SECURITY DEFINER bypasses RLS on profiles) ──────────────

CREATE OR REPLACE FUNCTION public.get_my_role()
  RETURNS TEXT
  LANGUAGE SQL
  SECURITY DEFINER
  STABLE
  SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_my_institution_id()
  RETURNS UUID
  LANGUAGE SQL
  SECURITY DEFINER
  STABLE
  SET search_path = public
AS $$
  SELECT institution_id FROM public.profiles WHERE id = auth.uid()
$$;

-- ── Drop all existing broad SELECT policies ──────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read all profiles"           ON public.profiles;

-- Also clean up any leftover policies from the rolled-back migrations
DROP POLICY IF EXISTS "Faculty can read all profiles"         ON public.profiles;
DROP POLICY IF EXISTS "Students can read relevant profiles"   ON public.profiles;
DROP POLICY IF EXISTS "Faculty can read institution profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read institution profiles"  ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile"            ON public.profiles;

-- ── New scoped policies ───────────────────────────────────────────────────────

-- 1. Every user can always read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = profiles.id);

-- 2. Faculty: all profiles within the same institution
--    (Preserves student approval/management workflow on the Students page)
CREATE POLICY "Faculty can read institution profiles"
  ON public.profiles FOR SELECT
  USING (
    public.get_my_role() = 'faculty'
    AND profiles.institution_id = public.get_my_institution_id()
  );

-- 3. Students: faculty profiles in their institution + enrolled classmates
--    (Needed for Q&A author display, announcement attribution, course views)
CREATE POLICY "Students can read relevant profiles"
  ON public.profiles FOR SELECT
  USING (
    public.get_my_role() = 'student'
    AND (
      -- all faculty in their institution (announcements, Q&A author display)
      (
        profiles.role = 'faculty'
        AND profiles.institution_id = public.get_my_institution_id()
      )
      -- classmates: any student sharing at least one enrolled course
      OR EXISTS (
        SELECT 1
        FROM public.course_enrollments e1
        JOIN public.course_enrollments e2 ON e1.course_id = e2.course_id
        WHERE e1.student_id = auth.uid()
          AND e2.student_id = profiles.id
      )
    )
  );

-- 4. Admins: all profiles in their institution
--    (admin role lives in institution_members, not profiles.role)
CREATE POLICY "Admins can read institution profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.institution_members im
      WHERE im.user_id  = auth.uid()
        AND im.role     = 'admin'
        AND im.institution_id = public.get_my_institution_id()
    )
  );
