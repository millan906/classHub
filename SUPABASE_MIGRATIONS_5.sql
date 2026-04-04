-- Grade book: custom columns (labs, assignments) and their per-student scores

create table if not exists public.grade_columns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('lab', 'assignment')),
  max_score numeric not null default 100,
  created_by uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.grade_entries (
  id uuid primary key default gen_random_uuid(),
  column_id uuid references public.grade_columns(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  score numeric,
  unique(column_id, student_id)
);

alter table public.grade_columns enable row level security;
alter table public.grade_entries enable row level security;

-- Faculty can manage their own columns
create policy "Faculty manage grade columns" on public.grade_columns
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

-- Anyone authenticated can read columns
create policy "Authenticated read grade columns" on public.grade_columns
  for select using (auth.role() = 'authenticated');

-- Faculty can manage entries for their columns
create policy "Faculty manage grade entries" on public.grade_entries
  using (exists (select 1 from public.grade_columns gc where gc.id = column_id and gc.created_by = auth.uid()))
  with check (exists (select 1 from public.grade_columns gc where gc.id = column_id and gc.created_by = auth.uid()));

-- Students can read their own entries
create policy "Students read own entries" on public.grade_entries
  for select using (auth.uid() = student_id);
