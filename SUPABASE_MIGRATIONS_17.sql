-- Migration 17: Backfill course_faculty from existing created_by
-- Every course already has a created_by (the faculty who made it).
-- This populates course_faculty so existing faculty don't lose access to their courses.

INSERT INTO public.course_faculty (course_id, faculty_id)
SELECT id, created_by
FROM public.courses
WHERE created_by IS NOT NULL
ON CONFLICT (course_id, faculty_id) DO NOTHING;
