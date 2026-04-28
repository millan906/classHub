-- RLS Isolation Test Suite
-- Run with: supabase test db
--
-- Asserts cross-institution and cross-user data isolation for the most
-- security-critical tables: quiz_submissions, grade_entries, quizzes,
-- announcements, and integrity_logs.
--
-- All fixture data is created inside the transaction and rolled back at the end.
-- Nothing touches production data.

BEGIN;
SELECT plan(17);

-- ─── Fixture UUIDs ────────────────────────────────────────────────────────────
-- Using well-known test UUIDs so they're easy to grep and won't collide with prod.

DO $$ BEGIN
  -- Auth users (superuser INSERT bypasses triggers)
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES
    ('00000000-test-0000-0000-faculty000001', 'faculty_a@rls.test', 'x', NOW(), NOW(), NOW(), '{}', '{}', 'authenticated', 'authenticated'),
    ('00000000-test-0000-0000-faculty000002', 'faculty_b@rls.test', 'x', NOW(), NOW(), NOW(), '{}', '{}', 'authenticated', 'authenticated'),
    ('00000000-test-0000-0000-student000001', 'student_a@rls.test', 'x', NOW(), NOW(), NOW(), '{}', '{}', 'authenticated', 'authenticated'),
    ('00000000-test-0000-0000-student000002', 'student_b@rls.test', 'x', NOW(), NOW(), NOW(), '{}', '{}', 'authenticated', 'authenticated');

  -- Profiles
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES
    ('00000000-test-0000-0000-faculty000001', 'faculty_a@rls.test', 'Faculty A', 'faculty', 'approved'),
    ('00000000-test-0000-0000-faculty000002', 'faculty_b@rls.test', 'Faculty B', 'faculty', 'approved'),
    ('00000000-test-0000-0000-student000001', 'student_a@rls.test', 'Student A', 'student', 'approved'),
    ('00000000-test-0000-0000-student000002', 'student_b@rls.test', 'Student B', 'student', 'approved');

  -- Courses (one per faculty)
  INSERT INTO public.courses (id, name, created_by)
  VALUES
    ('00000000-test-0000-0000-course0000001', 'Course A', '00000000-test-0000-0000-faculty000001'),
    ('00000000-test-0000-0000-course0000002', 'Course B', '00000000-test-0000-0000-faculty000002');

  -- Quizzes (one per faculty)
  INSERT INTO public.quizzes (id, title, course_id, created_by, is_open, results_visible)
  VALUES
    ('00000000-test-0000-0000-quiz00000001', 'Quiz A', '00000000-test-0000-0000-course0000001', '00000000-test-0000-0000-faculty000001', false, false),
    ('00000000-test-0000-0000-quiz00000002', 'Quiz B', '00000000-test-0000-0000-course0000002', '00000000-test-0000-0000-faculty000002', false, false);

  -- Submissions (one per student, each on their own faculty's quiz)
  INSERT INTO public.quiz_submissions (id, quiz_id, student_id, answers, score)
  VALUES
    ('00000000-test-0000-0000-sub000000001', '00000000-test-0000-0000-quiz00000001', '00000000-test-0000-0000-student000001', '{}', 80),
    ('00000000-test-0000-0000-sub000000002', '00000000-test-0000-0000-quiz00000002', '00000000-test-0000-0000-student000002', '{}', 90);

  -- Grade columns (one per faculty)
  INSERT INTO public.grade_columns (id, title, category, max_score, created_by)
  VALUES
    ('00000000-test-0000-0000-col000000001', 'Lab 1', 'lab', 100, '00000000-test-0000-0000-faculty000001'),
    ('00000000-test-0000-0000-col000000002', 'Lab 2', 'lab', 100, '00000000-test-0000-0000-faculty000002');

  -- Grade entries (one per student, each under their own faculty's column)
  INSERT INTO public.grade_entries (id, column_id, student_id, score)
  VALUES
    ('00000000-test-0000-0000-entry00000001', '00000000-test-0000-0000-col000000001', '00000000-test-0000-0000-student000001', 85),
    ('00000000-test-0000-0000-entry00000002', '00000000-test-0000-0000-col000000002', '00000000-test-0000-0000-student000002', 90);

  -- Announcements (one per faculty)
  INSERT INTO public.announcements (id, title, body, posted_by)
  VALUES
    ('00000000-test-0000-0000-ann000000001', 'Ann A', 'body', '00000000-test-0000-0000-faculty000001'),
    ('00000000-test-0000-0000-ann000000002', 'Ann B', 'body', '00000000-test-0000-0000-faculty000002');
END $$;


-- ─── quiz_submissions ─────────────────────────────────────────────────────────

-- 1. Student A can see their own submission
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "00000000-test-0000-0000-student000001", "role": "authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.quiz_submissions WHERE id = '00000000-test-0000-0000-sub000000001'),
  1,
  'Student A can read their own submission'
);

-- 2. Student A cannot see Student B's submission
SELECT is(
  (SELECT count(*)::int FROM public.quiz_submissions WHERE id = '00000000-test-0000-0000-sub000000002'),
  0,
  'Student A cannot read Student B submission'
);

-- 3. Student A cannot UPDATE any submission
SELECT throws_ok(
  $$ UPDATE public.quiz_submissions SET score = 100 WHERE id = '00000000-test-0000-0000-sub000000001' $$,
  'Student A cannot UPDATE quiz_submissions'
);

-- 4. Faculty A can see all submissions
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "00000000-test-0000-0000-faculty000001", "role": "authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.quiz_submissions),
  2,
  'Faculty A can read all submissions'
);

-- 5. Faculty A can UPDATE submission on their own quiz
SELECT lives_ok(
  $$ UPDATE public.quiz_submissions SET score = 85 WHERE id = '00000000-test-0000-0000-sub000000001' $$,
  'Faculty A can UPDATE submission for own quiz'
);

-- 6. Faculty A cannot UPDATE submission on Faculty B's quiz
SELECT is(
  (SELECT count(*)::int FROM public.quiz_submissions
   WHERE id = '00000000-test-0000-0000-sub000000002'
     AND score = 100
   ),
  0,
  'Faculty A UPDATE on Faculty B quiz submission is silently blocked by RLS'
);
-- (RLS silently blocks UPDATE on rows the policy excludes — no error, 0 rows affected)
UPDATE public.quiz_submissions SET score = 100 WHERE id = '00000000-test-0000-0000-sub000000002';
SELECT is(
  (SELECT score::int FROM public.quiz_submissions WHERE id = '00000000-test-0000-0000-sub000000002'),
  90,
  'Faculty B submission score unchanged after Faculty A attempted UPDATE'
);

-- 7. Student A cannot INSERT a submission with another student's ID
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "00000000-test-0000-0000-student000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ INSERT INTO public.quiz_submissions (quiz_id, student_id, answers, score)
     VALUES ('00000000-test-0000-0000-quiz00000001', '00000000-test-0000-0000-student000002', '{}', 100) $$,
  'Student A cannot INSERT submission with Student B id'
);


-- ─── grade_entries ────────────────────────────────────────────────────────────

-- 8. Student A sees only their own grade entry
SELECT is(
  (SELECT count(*)::int FROM public.grade_entries WHERE student_id = '00000000-test-0000-0000-student000001'),
  1,
  'Student A can read own grade entry'
);

-- 9. Student A cannot see Student B's grade entry
SELECT is(
  (SELECT count(*)::int FROM public.grade_entries WHERE student_id = '00000000-test-0000-0000-student000002'),
  0,
  'Student A cannot read Student B grade entry'
);

-- 10. Faculty A can INSERT a grade entry for their own column
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "00000000-test-0000-0000-faculty000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ INSERT INTO public.grade_entries (column_id, student_id, score)
     VALUES ('00000000-test-0000-0000-col000000001', '00000000-test-0000-0000-student000002', 70)
     ON CONFLICT (column_id, student_id) DO UPDATE SET score = 70 $$,
  'Faculty A can INSERT grade entry for own column'
);

-- 11. Faculty A cannot INSERT grade entry for Faculty B's column
SELECT throws_ok(
  $$ INSERT INTO public.grade_entries (column_id, student_id, score)
     VALUES ('00000000-test-0000-0000-col000000002', '00000000-test-0000-0000-student000001', 50) $$,
  'Faculty A cannot INSERT grade entry for Faculty B column'
);


-- ─── quizzes (write isolation) ────────────────────────────────────────────────

-- 12. Faculty A can UPDATE their own quiz
SELECT lives_ok(
  $$ UPDATE public.quizzes SET title = 'Quiz A (edited)' WHERE id = '00000000-test-0000-0000-quiz00000001' $$,
  'Faculty A can UPDATE own quiz'
);

-- 13. Faculty A cannot DELETE Faculty B's quiz (RLS silently blocks — 0 rows deleted)
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "00000000-test-0000-0000-faculty000001", "role": "authenticated"}';

DELETE FROM public.quizzes WHERE id = '00000000-test-0000-0000-quiz00000002';

RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.quizzes WHERE id = '00000000-test-0000-0000-quiz00000002'),
  1,
  'Faculty B quiz still exists after Faculty A attempted DELETE'
);


-- ─── announcements ────────────────────────────────────────────────────────────

-- 14. Faculty A can DELETE their own announcement
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "00000000-test-0000-0000-faculty000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ DELETE FROM public.announcements WHERE id = '00000000-test-0000-0000-ann000000001' $$,
  'Faculty A can DELETE own announcement'
);

-- 15. Faculty A cannot DELETE Faculty B's announcement
DELETE FROM public.announcements WHERE id = '00000000-test-0000-0000-ann000000002';

RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.announcements WHERE id = '00000000-test-0000-0000-ann000000002'),
  1,
  'Faculty B announcement still exists after Faculty A attempted DELETE'
);


-- ─── integrity_logs ───────────────────────────────────────────────────────────

-- 16. Student A can insert their own integrity log
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "00000000-test-0000-0000-student000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ INSERT INTO public.integrity_logs (quiz_id, student_id, event_type, severity)
     VALUES ('00000000-test-0000-0000-quiz00000001', '00000000-test-0000-0000-student000001', 'tab_switch', 'medium') $$,
  'Student A can insert own integrity log'
);

-- 17. Student A cannot insert an integrity log for Student B
SELECT throws_ok(
  $$ INSERT INTO public.integrity_logs (quiz_id, student_id, event_type, severity)
     VALUES ('00000000-test-0000-0000-quiz00000001', '00000000-test-0000-0000-student000002', 'tab_switch', 'high') $$,
  'Student A cannot insert integrity log for Student B'
);


-- ─── Done ─────────────────────────────────────────────────────────────────────

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
