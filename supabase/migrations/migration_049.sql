-- Migration 049: 30-minute close reminder via pg_cron
--
-- Adds reminder_sent_at to quizzes so the cron job can track which quizzes
-- have already had their 30-min reminder sent (prevents duplicate sends).
--
-- Creates a function send_quiz_close_reminders() that:
--   1. Finds open quizzes whose close_at is 28–32 minutes from now
--      AND reminder_sent_at IS NULL (not yet reminded)
--   2. Inserts a 'quiz_reminder' notification for every enrolled student
--   3. Stamps reminder_sent_at so it never fires again for that quiz
--
-- Schedules the function to run every minute via pg_cron.
-- NOTE: pg_cron must be enabled in your Supabase project (Database → Extensions → pg_cron).

-- ── Schema ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- ── Reminder function ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.send_quiz_close_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r          RECORD;
  course_label text;
  type_label   text;
BEGIN
  FOR r IN
    SELECT q.id,
           q.title,
           q.course_id,
           q.item_type,
           q.close_at,
           c.name    AS course_name,
           c.section AS course_section
    FROM   public.quizzes q
    LEFT   JOIN public.courses c ON c.id::text = q.course_id::text
    WHERE  q.is_open = true
      AND  q.close_at IS NOT NULL
      AND  q.close_at BETWEEN (now() + interval '28 minutes')
                          AND (now() + interval '32 minutes')
      AND  q.reminder_sent_at IS NULL
  LOOP
    course_label := COALESCE(r.course_name, '')
      || CASE WHEN r.course_section IS NOT NULL
              THEN ' · Section ' || r.course_section
              ELSE '' END;

    type_label := CASE
      WHEN r.item_type IS NOT NULL
        THEN upper(left(r.item_type, 1)) || substr(r.item_type, 2)
      ELSE 'Assessment'
    END;

    INSERT INTO public.notifications
           (user_id, title, body, type, related_id, course_name)
    SELECT ce.student_id,
           r.title || ' closes in 30 minutes',
           type_label || ' is closing soon. Submit before time runs out.',
           'quiz_reminder',
           r.id,
           NULLIF(course_label, '')
    FROM   public.course_enrollments ce
    WHERE  ce.course_id::text = r.course_id::text;

    UPDATE public.quizzes
    SET    reminder_sent_at = now()
    WHERE  id = r.id;
  END LOOP;
END;
$$;

-- ── Schedule (runs every minute) ───────────────────────────────────────────────
-- Remove any existing schedule with this name first to make this idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'quiz-30min-reminder') THEN
    PERFORM cron.unschedule('quiz-30min-reminder');
  END IF;
END;
$$;

SELECT cron.schedule(
  'quiz-30min-reminder',
  '* * * * *',
  'SELECT public.send_quiz_close_reminders()'
);
