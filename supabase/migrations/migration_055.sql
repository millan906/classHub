-- Migration 055: Fix profiles SELECT exposure
--
-- Live DB has two broad SELECT policies that grant all authenticated users
-- read access to every profile in the database:
--
--   "Users can read all profiles"         qual: true
--   "Authenticated users can read profiles" qual: auth.role() = 'authenticated'
--
-- These nullify the scoped "Users can read institution profiles" policy
-- (RLS uses OR logic — any passing policy grants access).
--
-- Additionally "Users can read institution profiles" is still too broad for
-- students — it exposes all profiles in the institution, including other
-- students' email, student_no, program, section.
--
-- Fix: drop all three broad policies and replace with role-scoped policies.
-- Uses the existing SECURITY DEFINER helpers (get_my_role, get_my_institution_id)
-- to avoid infinite recursion from querying profiles inside a profiles policy.

DROP POLICY IF EXISTS "Users can read all profiles"              ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles"    ON public.profiles;
DROP POLICY IF EXISTS "Users can read institution profiles"      ON public.profiles;

-- Clean up any leftover policies from prior rolled-back migrations
DROP POLICY IF EXISTS "Faculty can read all profiles"            ON public.profiles;
DROP POLICY IF EXISTS "Students can read relevant profiles"      ON public.profiles;
DROP POLICY IF EXISTS "Faculty can read institution profiles"    ON public.profiles;
DROP POLICY IF EXISTS "Admins can read institution profiles"     ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile"               ON public.profiles;

-- 1. Every user can always read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = profiles.id);

-- 2. Faculty: all profiles within their institution
--    (needed for student approval flow, gradebook, Q&A)
CREATE POLICY "Faculty can read institution profiles"
  ON public.profiles FOR SELECT
  USING (
    public.get_my_role() = 'faculty'
    AND profiles.institution_id = public.get_my_institution_id()
  );

-- 3. Students: faculty profiles in their institution + enrolled classmates only
--    (Q&A author display, announcement attribution, course views)
--    Blocks: reading other students' email, student_no, program, section
--    across courses they are not enrolled in
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
CREATE POLICY "Admins can read institution profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.institution_members im
      WHERE im.user_id      = auth.uid()
        AND im.role         = 'admin'
        AND im.institution_id = public.get_my_institution_id()
    )
  );
