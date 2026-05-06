-- Migration 057: Scope grade_entries RLS policies
--
-- Current state (two gaps):
--
--   SELECT  "Anyone authenticated can read grade entries"
--           qual: auth.role() = 'authenticated'
--           → students can read ALL students' scores, not just their own
--
--   INSERT  "Faculty can insert grade entries"
--   UPDATE  "Faculty can update grade entries"
--   DELETE  "Faculty can delete grade entries"
--           qual: EXISTS (profiles WHERE role = 'faculty')
--           → any faculty can write to any column, including another faculty's
--
-- Fix:
--   SELECT  Students see only their own entries.
--           Faculty see all entries in columns they own.
--   INSERT  Faculty can only insert into columns they created.
--   UPDATE  Faculty can only update entries in columns they created.
--   DELETE  Faculty can only delete entries in columns they created.
--
-- Scope path: grade_entries.column_id → grade_columns.created_by = auth.uid()

-- ── Drop all existing grade_entries policies ──────────────────────────────────

DROP POLICY IF EXISTS "Anyone authenticated can read grade entries" ON public.grade_entries;
DROP POLICY IF EXISTS "Faculty can insert grade entries"            ON public.grade_entries;
DROP POLICY IF EXISTS "Faculty can update grade entries"            ON public.grade_entries;
DROP POLICY IF EXISTS "Faculty can delete grade entries"            ON public.grade_entries;

-- ── SELECT ────────────────────────────────────────────────────────────────────

-- Students: own entries only
CREATE POLICY "Students can read own grade entries"
  ON public.grade_entries FOR SELECT
  USING (auth.uid() = student_id);

-- Faculty: all entries in columns they created
CREATE POLICY "Faculty can read own column grade entries"
  ON public.grade_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.grade_columns gc
      WHERE gc.id = grade_entries.column_id
        AND gc.created_by = auth.uid()
    )
  );

-- ── INSERT ────────────────────────────────────────────────────────────────────

CREATE POLICY "Faculty can insert grade entries"
  ON public.grade_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.grade_columns gc
      WHERE gc.id = grade_entries.column_id
        AND gc.created_by = auth.uid()
    )
  );

-- ── UPDATE ────────────────────────────────────────────────────────────────────

CREATE POLICY "Faculty can update grade entries"
  ON public.grade_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.grade_columns gc
      WHERE gc.id = grade_entries.column_id
        AND gc.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.grade_columns gc
      WHERE gc.id = grade_entries.column_id
        AND gc.created_by = auth.uid()
    )
  );

-- ── DELETE ────────────────────────────────────────────────────────────────────

CREATE POLICY "Faculty can delete grade entries"
  ON public.grade_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.grade_columns gc
      WHERE gc.id = grade_entries.column_id
        AND gc.created_by = auth.uid()
    )
  );
