-- Migration 032: Security hardening — enable RLS on unprotected tables, fix always-true policy
-- Addresses Supabase Security Advisor findings as of 2026-04-26
--
-- NOTE (not SQL — requires Supabase Dashboard):
--   • Leaked Password Protection: enable at Dashboard → Auth → Settings → Leaked password protection.
--
-- Storage buckets remain public (files serve via public URLs as expected).
-- The fix below restricts anonymous *listing* of bucket contents without breaking file access.


-- ── 1. file_submissions ────────────────────────────────────────────────────────
-- Policies already exist from migration_009; RLS was disabled in the dashboard.
ALTER TABLE public.file_submissions ENABLE ROW LEVEL SECURITY;


-- ── 2. attendance_sessions ─────────────────────────────────────────────────────
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

-- Faculty assigned to the course can create / update / delete sessions
CREATE POLICY "Faculty manage own course sessions"
  ON public.attendance_sessions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_faculty cf
      WHERE cf.course_id = attendance_sessions.course_id
        AND cf.faculty_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.course_faculty cf
      WHERE cf.course_id = attendance_sessions.course_id
        AND cf.faculty_id = auth.uid()
    )
  );

-- Students enrolled in the course can read sessions
CREATE POLICY "Students read enrolled course sessions"
  ON public.attendance_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_enrollments ce
      WHERE ce.course_id = attendance_sessions.course_id
        AND ce.student_id = auth.uid()
    )
  );


-- ── 3. attendance_records ──────────────────────────────────────────────────────
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Faculty can manage records for sessions in their courses
CREATE POLICY "Faculty manage records for own course sessions"
  ON public.attendance_records FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      JOIN public.course_faculty cf ON cf.course_id = s.course_id
      WHERE s.id = attendance_records.session_id
        AND cf.faculty_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      JOIN public.course_faculty cf ON cf.course_id = s.course_id
      WHERE s.id = attendance_records.session_id
        AND cf.faculty_id = auth.uid()
    )
  );

-- Students can read their own records
CREATE POLICY "Students read own attendance records"
  ON public.attendance_records FOR SELECT TO authenticated
  USING (auth.uid() = student_id);


-- ── 4. attendance_flags ────────────────────────────────────────────────────────
ALTER TABLE public.attendance_flags ENABLE ROW LEVEL SECURITY;

-- Faculty can manage flags for courses they teach
CREATE POLICY "Faculty manage flags for own courses"
  ON public.attendance_flags FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_faculty cf
      WHERE cf.course_id = attendance_flags.course_id
        AND cf.faculty_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.course_faculty cf
      WHERE cf.course_id = attendance_flags.course_id
        AND cf.faculty_id = auth.uid()
    )
  );

-- Students can read their own flags
CREATE POLICY "Students read own attendance flags"
  ON public.attendance_flags FOR SELECT TO authenticated
  USING (auth.uid() = student_id);


-- ── 5. institution_members ─────────────────────────────────────────────────────
ALTER TABLE public.institution_members ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read institution_members (required for join/lookup flows)
-- Acceptable for closed institution system (all users are known institution members)
CREATE POLICY "Authenticated users view institution members"
  ON public.institution_members FOR SELECT TO authenticated
  USING (true);

-- Users can only create their own membership record
CREATE POLICY "Users create own institution membership"
  ON public.institution_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);


-- ── 6. institutions ────────────────────────────────────────────────────────────
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can view institutions (needed for slug lookup at join time)
CREATE POLICY "Authenticated users view institutions"
  ON public.institutions FOR SELECT TO authenticated
  USING (true);

-- Any authenticated user can create an institution (registration flow)
CREATE POLICY "Authenticated users create institutions"
  ON public.institutions FOR INSERT TO authenticated
  WITH CHECK (true);


-- ── 7. notifications — replace always-true SELECT with recipient-scoped policy ──
-- Drop all existing notifications policies (names are unknown; created outside migrations)
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', pol.policyname);
  END LOOP;
END $$;

-- Users can only read their own notifications
CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Any authenticated user can insert notifications (faculty sends to students)
CREATE POLICY "Authenticated users insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- Users can update (mark as read) their own notifications only
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── 8. Storage — restrict anonymous listing (buckets stay public for URL access) ──
-- Buckets: attachments, course-resources, pdf-quizzes, slides, submissions
-- Public bucket URLs continue to work. This only blocks unauthenticated enumeration.

-- Drop any existing overly-permissive select policies on storage.objects for these buckets
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname ILIKE '%public%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Only authenticated users can list / read objects in these buckets
CREATE POLICY "Authenticated users can read storage objects"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id IN ('attachments', 'course-resources', 'pdf-quizzes', 'slides', 'submissions')
  );

-- Authenticated users can upload to these buckets
CREATE POLICY "Authenticated users can upload storage objects"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('attachments', 'course-resources', 'pdf-quizzes', 'slides', 'submissions')
  );

-- Users can delete their own uploads (owner = auth.uid()::text)
CREATE POLICY "Users can delete own storage objects"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('attachments', 'course-resources', 'pdf-quizzes', 'slides', 'submissions')
    AND owner = auth.uid()::text
  );
