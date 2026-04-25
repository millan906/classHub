-- Migration 9: Support all item types (Lab, Assignment, Project, Exam) in quizzes table
-- Also adds file upload support.

-- Extend quizzes table
alter table public.quizzes
  add column if not exists item_type text not null default 'quiz'
    check (item_type in ('quiz', 'lab', 'assignment', 'project', 'exam'));

alter table public.quizzes
  add column if not exists allow_file_upload boolean not null default false;

alter table public.quizzes
  add column if not exists description text;

alter table public.quizzes
  add column if not exists grade_group_id uuid references public.grade_groups(id) on delete set null;

-- File submissions table
-- NOTE: Also create a storage bucket named 'submissions' in the Supabase dashboard
--       (Storage → New bucket → Name: submissions → Public: true)
create table if not exists public.file_submissions (
  id          uuid primary key default gen_random_uuid(),
  quiz_id     uuid references public.quizzes(id) on delete cascade not null,
  student_id  uuid references public.profiles(id) on delete cascade not null,
  file_url    text not null,
  file_name   text not null,
  file_size   bigint,
  submitted_at timestamptz default now(),
  unique(quiz_id, student_id)
);

alter table public.file_submissions enable row level security;

create policy "Students manage own file submissions" on public.file_submissions
  for all using (auth.uid() = student_id) with check (auth.uid() = student_id);

create policy "Faculty read all file submissions" on public.file_submissions
  for select using (auth.role() = 'authenticated');
