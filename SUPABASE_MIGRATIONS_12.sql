-- Migration 12: Comprehensive Row Level Security for all tables
-- Run this once. Policies use IF NOT EXISTS equivalents via named policies.
-- Tables already covered by prior migrations are included with ENABLE RLS
-- (idempotent) and only the missing policies are added.

-- ─── Helper: reference profiles for role checks ──────────────────────────────
-- We check role via the profiles table joined on auth.uid(), since Supabase
-- does not store custom claims in auth.users by default.

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read profiles (needed for Q&A poster names,
-- student lists, avatar initials, etc.)
CREATE POLICY "Authenticated users can read profiles"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can update only their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────────────────────
-- slides
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.slides ENABLE ROW LEVEL SECURITY;

-- Faculty can manage (insert/update/delete) their own slides
CREATE POLICY "Faculty manage own slides"
  ON public.slides FOR ALL
  USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by);

-- All authenticated users can view slides
CREATE POLICY "Authenticated users can view slides"
  ON public.slides FOR SELECT
  USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- quizzes
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- Faculty can manage their own quizzes
CREATE POLICY "Faculty manage own quizzes"
  ON public.quizzes FOR ALL
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- All authenticated users can read quizzes
CREATE POLICY "Authenticated users can view quizzes"
  ON public.quizzes FOR SELECT
  USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- quiz_questions
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

-- Faculty can manage questions for quizzes they own
CREATE POLICY "Faculty manage own quiz questions"
  ON public.quiz_questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.created_by = auth.uid()
    )
  );

-- All authenticated users can read questions
CREATE POLICY "Authenticated users can view quiz questions"
  ON public.quiz_questions FOR SELECT
  USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- quiz_submissions
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.quiz_submissions ENABLE ROW LEVEL SECURITY;

-- Students can insert their own submissions
CREATE POLICY "Students can submit quizzes"
  ON public.quiz_submissions FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Students can read their own submissions
CREATE POLICY "Students can view own submissions"
  ON public.quiz_submissions FOR SELECT
  USING (auth.uid() = student_id);

-- Faculty can read all submissions
CREATE POLICY "Faculty can view all submissions"
  ON public.quiz_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'faculty'
    )
  );

-- NOTE: Faculty UPDATE policy for essay grading was added in migration 10.

-- ─────────────────────────────────────────────────────────────────────────────
-- announcements
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Faculty can manage their own announcements
CREATE POLICY "Faculty manage own announcements"
  ON public.announcements FOR ALL
  USING (auth.uid() = posted_by)
  WITH CHECK (auth.uid() = posted_by);

-- All authenticated users can read announcements
CREATE POLICY "Authenticated users can view announcements"
  ON public.announcements FOR SELECT
  USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- questions (Q&A)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read questions
CREATE POLICY "Authenticated users can view questions"
  ON public.questions FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can post their own questions
CREATE POLICY "Users can post questions"
  ON public.questions FOR INSERT
  WITH CHECK (auth.uid() = posted_by);

-- Users can update/delete their own questions; faculty can update any (mark answered)
CREATE POLICY "Users manage own questions"
  ON public.questions FOR UPDATE
  USING (
    auth.uid() = posted_by
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'faculty'
    )
  );

CREATE POLICY "Users delete own questions"
  ON public.questions FOR DELETE
  USING (auth.uid() = posted_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- answers (Q&A)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read answers
CREATE POLICY "Authenticated users can view answers"
  ON public.answers FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can post answers
CREATE POLICY "Users can post answers"
  ON public.answers FOR INSERT
  WITH CHECK (auth.uid() = posted_by);

-- Users can update their own answers; faculty can endorse any answer
CREATE POLICY "Users manage own answers"
  ON public.answers FOR UPDATE
  USING (
    auth.uid() = posted_by
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'faculty'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Verify (run manually to check)
-- ─────────────────────────────────────────────────────────────────────────────
/*
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
-- All tables should show rowsecurity = true
*/
