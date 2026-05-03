-- Migration 051: Q&A course scoping + direct messaging
--
-- Adds two nullable columns to questions:
--   course_id    — NULL means visible to all courses (broadcast); non-null scopes to enrolled students
--   recipient_id — NULL means public/everyone; non-null means DM to a specific student (auto-private)
--
-- RLS is updated so:
--   Faculty: see all questions (unchanged)
--   Students: only see questions where they are enrolled in the course (or course_id IS NULL)
--             AND the question is public, their own, or they are the DM recipient

-- ── Schema changes ──────────────────────────────────────────────────────────

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS course_id    UUID REFERENCES public.courses(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.profiles(id)  ON DELETE SET NULL;

-- ── questions SELECT ────────────────────────────────────────────────────────

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
        -- Course scope: no course restriction, or student is enrolled in that course
        (
          course_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.course_enrollments ce
            WHERE ce.course_id = questions.course_id
              AND ce.student_id = auth.uid()
          )
        )
        AND (
          -- Visibility: public, or poster, or DM recipient
          NOT is_private
          OR posted_by = auth.uid()
          OR recipient_id = auth.uid()
        )
      )
    )
  );

-- ── answers SELECT ──────────────────────────────────────────────────────────

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
              OR q.recipient_id = auth.uid()
            )
          )
        )
    )
  );

-- ── answers INSERT ──────────────────────────────────────────────────────────

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
              OR q.recipient_id = auth.uid()
            )
          )
        )
    )
  );
