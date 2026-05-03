-- Migration 053: Replace recipient_id (single) with recipient_ids (array) on questions
--
-- Allows faculty to target one or more students in a single Q&A post.
-- UUID arrays in Postgres cannot have FK constraints, so referential integrity
-- is enforced at the application layer.

ALTER TABLE public.questions
  DROP COLUMN IF EXISTS recipient_id,
  ADD COLUMN IF NOT EXISTS recipient_ids UUID[] DEFAULT NULL;

-- ── questions SELECT (replace policy from migration_051) ────────────────────

DROP POLICY IF EXISTS "Users can view questions" ON public.questions;

CREATE POLICY "Users can view questions"
  ON public.questions FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      -- Faculty see everything
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'faculty'
      )
      OR (
        -- Course scope: no restriction, or student is enrolled in that course
        (
          course_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.course_enrollments ce
            WHERE ce.course_id = questions.course_id
              AND ce.student_id = auth.uid()
          )
        )
        AND (
          NOT is_private
          OR posted_by = auth.uid()
          OR auth.uid() = ANY(recipient_ids)
        )
      )
    )
  );

-- ── answers SELECT (replace policy from migration_051) ──────────────────────

DROP POLICY IF EXISTS "Users can view answers" ON public.answers;

CREATE POLICY "Users can view answers"
  ON public.answers FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.questions q
      WHERE q.id = question_id
        AND (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'faculty'
          )
          OR (
            (
              q.course_id IS NULL
              OR EXISTS (
                SELECT 1 FROM public.course_enrollments ce
                WHERE ce.course_id = q.course_id
                  AND ce.student_id = auth.uid()
              )
            )
            AND (
              NOT q.is_private
              OR q.posted_by = auth.uid()
              OR auth.uid() = ANY(q.recipient_ids)
            )
          )
        )
    )
  );

-- ── answers INSERT (replace policy from migration_051) ──────────────────────

DROP POLICY IF EXISTS "Users can post answers" ON public.answers;

CREATE POLICY "Users can post answers"
  ON public.answers FOR INSERT
  WITH CHECK (
    auth.uid() = posted_by
    AND EXISTS (
      SELECT 1 FROM public.questions q
      WHERE q.id = question_id
        AND (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'faculty'
          )
          OR (
            (
              q.course_id IS NULL
              OR EXISTS (
                SELECT 1 FROM public.course_enrollments ce
                WHERE ce.course_id = q.course_id
                  AND ce.student_id = auth.uid()
              )
            )
            AND (
              NOT q.is_private
              OR q.posted_by = auth.uid()
              OR auth.uid() = ANY(q.recipient_ids)
            )
          )
        )
    )
  );
