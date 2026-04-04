-- Add course/subject tag + time limit + lockdown to quizzes
alter table public.quizzes
  add column if not exists course text,
  add column if not exists time_limit_minutes integer,
  add column if not exists lockdown_enabled boolean not null default false;

-- Add question type + code snippet fields
alter table public.quiz_questions
  add column if not exists type text not null default 'mcq' check (type in ('mcq', 'truefalse', 'codesnippet')),
  add column if not exists code_snippet text,
  add column if not exists code_language text;

-- Add timer tracking to submissions
alter table public.quiz_submissions
  add column if not exists started_at timestamptz,
  add column if not exists auto_submitted boolean not null default false;

-- Integrity logs table
create table if not exists public.integrity_logs (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  event_type text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  occurred_at timestamptz default now()
);
alter table public.integrity_logs enable row level security;
create policy "Students can insert own logs" on public.integrity_logs for insert with check (auth.uid() = student_id);
create policy "Faculty or owner can read logs" on public.integrity_logs for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'faculty')
  or auth.uid() = student_id
);
