-- Migration 14: PDF Quizzes
-- Faculty uploads a PDF quiz file + answer key; students answer in-app; auto-scored.

-- Storage bucket for PDF quiz files
insert into storage.buckets (id, name, public)
  values ('pdf-quizzes', 'pdf-quizzes', true)
  on conflict (id) do nothing;

create policy "Authenticated users can read pdf quiz files"
  on storage.objects for select to authenticated
  using (bucket_id = 'pdf-quizzes');

create policy "Authenticated users can upload pdf quiz files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'pdf-quizzes');

create policy "Authenticated users can delete pdf quiz files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'pdf-quizzes');

-- pdf_quizzes: root entity
create table public.pdf_quizzes (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  course_id      uuid references public.courses(id) on delete set null,
  grade_group_id uuid references public.grade_groups(id) on delete set null,
  pdf_path       text not null,
  due_date       date,
  is_open        boolean not null default false,
  max_attempts   int not null default 1,
  num_questions  int not null default 0,
  total_points   int not null default 0,
  created_by     uuid references public.profiles(id) on delete cascade not null,
  created_at     timestamptz default now()
);

alter table public.pdf_quizzes enable row level security;

create policy "Authenticated users can read pdf_quizzes"
  on public.pdf_quizzes for select to authenticated using (true);

create policy "Faculty can insert pdf_quizzes"
  on public.pdf_quizzes for insert to authenticated
  with check (auth.uid() = created_by);

create policy "Faculty can update own pdf_quizzes"
  on public.pdf_quizzes for update to authenticated
  using (auth.uid() = created_by);

create policy "Faculty can delete own pdf_quizzes"
  on public.pdf_quizzes for delete to authenticated
  using (auth.uid() = created_by);

-- pdf_quiz_answer_key: one row per question
-- Readable by all authenticated users (same model as quiz_questions in the existing system).
-- question_type is exposed so the student UI can render the correct input control.
-- Scoring is done client-side by comparing the student's answer to correct_answer.
create table public.pdf_quiz_answer_key (
  id              uuid primary key default gen_random_uuid(),
  pdf_quiz_id     uuid references public.pdf_quizzes(id) on delete cascade not null,
  question_number int not null,
  question_type   text not null default 'text', -- 'mcq' | 'truefalse' | 'text'
  correct_answer  text not null,
  points          int not null default 1,
  unique(pdf_quiz_id, question_number)
);

alter table public.pdf_quiz_answer_key enable row level security;

create policy "Authenticated users can read answer key"
  on public.pdf_quiz_answer_key for select to authenticated using (true);

create policy "Faculty can insert answer key"
  on public.pdf_quiz_answer_key for insert to authenticated
  with check (
    exists (select 1 from public.pdf_quizzes where id = pdf_quiz_id and created_by = auth.uid())
  );

create policy "Faculty can update answer key"
  on public.pdf_quiz_answer_key for update to authenticated
  using (
    exists (select 1 from public.pdf_quizzes where id = pdf_quiz_id and created_by = auth.uid())
  );

create policy "Faculty can delete answer key"
  on public.pdf_quiz_answer_key for delete to authenticated
  using (
    exists (select 1 from public.pdf_quizzes where id = pdf_quiz_id and created_by = auth.uid())
  );

-- pdf_quiz_submissions: one row per attempt per student
create table public.pdf_quiz_submissions (
  id            uuid primary key default gen_random_uuid(),
  pdf_quiz_id   uuid references public.pdf_quizzes(id) on delete cascade not null,
  student_id    uuid references public.profiles(id) on delete cascade not null,
  answers       jsonb not null default '{}',
  earned_points int not null default 0,
  score         int not null default 0,
  attempt_number int not null default 1,
  submitted_at  timestamptz default now()
);

alter table public.pdf_quiz_submissions enable row level security;

create policy "Students can insert own pdf submissions"
  on public.pdf_quiz_submissions for insert to authenticated
  with check (auth.uid() = student_id);

create policy "Students read own, faculty read all pdf submissions"
  on public.pdf_quiz_submissions for select to authenticated
  using (
    auth.uid() = student_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'faculty')
  );
