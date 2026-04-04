-- Points per question
alter table public.quiz_questions
  add column if not exists points integer not null default 1;

-- Max attempts per quiz
alter table public.quizzes
  add column if not exists max_attempts integer not null default 1;

-- Attempt tracking in submissions
alter table public.quiz_submissions
  add column if not exists attempt_number integer not null default 1,
  add column if not exists earned_points integer,
  add column if not exists total_points integer;

-- Drop old unique constraint (only 1 submission per student), allow multiple attempts
alter table public.quiz_submissions
  drop constraint if exists quiz_submissions_quiz_id_student_id_key;

-- New unique constraint includes attempt_number
alter table public.quiz_submissions
  add constraint if not exists quiz_submissions_quiz_student_attempt_key
  unique (quiz_id, student_id, attempt_number);
