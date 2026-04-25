-- Migration 027: HIGH priority RLS security fixes
-- Fix #6: quiz_submissions faculty UPDATE scoped to own quizzes only
-- Fix #7: profiles SELECT scoped — students cannot read all other students' data

-- ─── Fix #6: quiz_submissions faculty UPDATE ────────────────────────────────
-- Old policy allowed any faculty to update any student's submission.
-- New policy restricts faculty to only update submissions for their own quizzes.

DROP POLICY IF EXISTS "Faculty can update submissions for grading" ON public.quiz_submissions;

CREATE POLICY "Faculty can update own quiz submissions"
  ON public.quiz_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_submissions.quiz_id
        AND q.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_submissions.quiz_id
        AND q.created_by = auth.uid()
    )
  );

-- ─── Fix #7: profiles SELECT ────────────────────────────────────────────────
-- Old policy: auth.role() = 'authenticated' → all profiles visible to everyone.
-- New policy splits into two non-overlapping rules:
--   Faculty: can read all profiles (they need full student lists)
--   Students: can read own profile + all faculty profiles + classmates in shared courses
--
-- This preserves:
--   - Faculty seeing enrolled students in gradebook / Q&A
--   - Students seeing faculty name/avatar on announcements and Q&A
--   - Students seeing classmate names in Q&A / shared course contexts
-- This blocks:
--   - Students reading other students' email, student_no, program, section
--     across courses they are not enrolled in

DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;

CREATE POLICY "Faculty can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'faculty'
    )
  );

CREATE POLICY "Students can read relevant profiles"
  ON public.profiles FOR SELECT
  USING (
    -- own profile
    auth.uid() = profiles.id
    -- all faculty profiles (for announcements, Q&A author display)
    OR profiles.role = 'faculty'
    -- classmates: any student enrolled in the same course
    OR EXISTS (
      SELECT 1
      FROM public.course_enrollments e1
      JOIN public.course_enrollments e2 ON e1.course_id = e2.course_id
      WHERE e1.student_id = auth.uid()
        AND e2.student_id = profiles.id
    )
  );
