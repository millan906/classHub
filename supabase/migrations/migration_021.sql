-- ============================================================
-- Migration 21: RLS Security Fixes (items 1–5)
-- ============================================================

-- ── Fix 1: pdf_quiz_answer_key ──────────────────────────────
-- Was: SELECT true (anyone, even unauthenticated)
-- Now: faculty only
DROP POLICY IF EXISTS "Authenticated users can read answer key" ON public.pdf_quiz_answer_key;
CREATE POLICY "Faculty can read answer key" ON public.pdf_quiz_answer_key
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'faculty')
  );

-- ── Fix 2: pdf_quiz_essay_rubric ────────────────────────────
-- Was: SELECT true (anyone, even unauthenticated)
-- Now: faculty only
DROP POLICY IF EXISTS "Authenticated users can read essay rubric" ON public.pdf_quiz_essay_rubric;
CREATE POLICY "Faculty can read essay rubric" ON public.pdf_quiz_essay_rubric
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'faculty')
  );

-- ── Fix 3: pdf_quizzes ──────────────────────────────────────
-- Was: SELECT true (unauthenticated access)
-- Now: must be logged in
DROP POLICY IF EXISTS "Authenticated users can read pdf_quizzes" ON public.pdf_quizzes;
CREATE POLICY "Authenticated users can read pdf_quizzes" ON public.pdf_quizzes
  FOR SELECT USING (auth.role() = 'authenticated');

-- ── Fix 4: file_submissions ─────────────────────────────────
-- Was: faculty SELECT = auth.role() = 'authenticated' (any student could read all files)
-- Now: scoped to actual faculty role
DROP POLICY IF EXISTS "Faculty read all file submissions" ON public.file_submissions;
CREATE POLICY "Faculty read all file submissions" ON public.file_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'faculty')
  );

-- ── Fix 5: pending_roster ───────────────────────────────────
-- Was: ALL with true/true (any authenticated user had full access)
-- Now: faculty only (Edge Function uses service_role key, bypasses RLS — unaffected)
DROP POLICY IF EXISTS "Authenticated can manage pending_roster" ON public.pending_roster;
CREATE POLICY "Faculty can manage pending_roster" ON public.pending_roster
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'faculty')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'faculty')
  );
