-- Migration 048: Enforce privacy on Q&A answers
--
-- The answers table had a fully open SELECT policy ("Authenticated users can view answers")
-- and an INSERT policy that only checked posted_by — neither respected question privacy.
-- A student could read or post answers to a private question they don't own.
--
-- This migration:
--   1. Tightens the answers SELECT policy: students can only see answers to questions
--      they have access to (public, or their own private, or faculty).
--   2. Tightens the answers INSERT policy: students can only answer questions they
--      have access to.
--   3. Re-applies the questions SELECT policy (idempotent) to guarantee it is active
--      even if migration_037 did not land cleanly.

-- ── questions SELECT (re-apply to be safe) ─────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can view questions" ON public.questions;
DROP POLICY IF EXISTS "Users can view questions" ON public.questions;

CREATE POLICY "Users can view questions"
  ON public.questions FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      NOT is_private
      OR posted_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'faculty'
      )
    )
  );

-- ── answers SELECT ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can view answers" ON public.answers;
DROP POLICY IF EXISTS "Users can view answers" ON public.answers;

CREATE POLICY "Users can view answers"
  ON public.answers FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.questions q
      WHERE q.id = question_id
        AND (
          NOT q.is_private
          OR q.posted_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'faculty'
          )
        )
    )
  );

-- ── answers INSERT ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can post answers" ON public.answers;

CREATE POLICY "Users can post answers"
  ON public.answers FOR INSERT
  WITH CHECK (
    auth.uid() = posted_by
    AND EXISTS (
      SELECT 1 FROM public.questions q
      WHERE q.id = question_id
        AND (
          NOT q.is_private
          OR q.posted_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'faculty'
          )
        )
    )
  );
