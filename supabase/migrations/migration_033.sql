-- Migration 033: Allow admins to insert institution members for their institution
--
-- The existing INSERT policy only allows users to create their OWN membership
-- (WITH CHECK auth.uid() = user_id). Admins importing enrolled students need
-- to insert rows on behalf of other users. This adds a second INSERT policy
-- that permits any authenticated user with role='admin' in profiles to insert.
--
-- Uses profiles table (not institution_members) to avoid self-referencing recursion.

CREATE POLICY "Admins can add institution members"
  ON public.institution_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
