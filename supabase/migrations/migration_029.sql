-- Migration 029: Fix infinite recursion in profiles RLS policy
--
-- Root cause: "Faculty can read all profiles" used a subquery on public.profiles
-- to check if the caller is faculty — which triggers the same RLS policy again,
-- causing PostgreSQL to throw: "infinite recursion detected in policy for relation profiles"
--
-- Fix: use a SECURITY DEFINER function that reads role bypassing RLS,
-- then reference that function in the policy instead.

-- Step 1: Helper function — reads caller's role without triggering RLS
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- Step 2: Recreate profiles SELECT policies using the helper function

DROP POLICY IF EXISTS "Faculty can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Students can read relevant profiles" ON public.profiles;

CREATE POLICY "Faculty can read all profiles"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() = 'faculty');

CREATE POLICY "Students can read relevant profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = profiles.id
    OR profiles.role = 'faculty'
    OR EXISTS (
      SELECT 1
      FROM public.course_enrollments e1
      JOIN public.course_enrollments e2 ON e1.course_id = e2.course_id
      WHERE e1.student_id = auth.uid()
        AND e2.student_id = profiles.id
    )
  );
