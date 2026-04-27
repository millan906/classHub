-- Migration 037: Private questions
--
-- Adds is_private flag to questions. Private questions are visible only to
-- the poster and faculty — other students cannot see them.
--
-- Also replaces the broad "Authenticated users can view questions" policy
-- (which ignores is_private) with a scoped one.

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- ── Replace broad SELECT policy ───────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can view questions" ON public.questions;

CREATE POLICY "Users can view questions"
  ON public.questions FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      -- public questions: everyone can see
      NOT is_private
      -- private questions: only the poster
      OR posted_by = auth.uid()
      -- private questions: faculty can always see
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'faculty'
      )
    )
  );
