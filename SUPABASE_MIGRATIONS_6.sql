-- =============================================================
-- MIGRATION 6: Grouped gradebook — Phase 1 & 2
-- Phase 1: schema changes (grade_groups + extend grade_columns)
-- Phase 2: seed default groups + migrate existing category data
-- =============================================================


-- ---------------------------------------------------------------
-- PHASE 1A: Create grade_groups
-- ---------------------------------------------------------------

create table if not exists public.grade_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  weight_percent numeric not null default 0
    check (weight_percent >= 0 and weight_percent <= 100),
  created_by  uuid references public.profiles(id) on delete cascade,
  created_at  timestamptz default now(),
  unique (created_by, name)   -- one group name per faculty
);

alter table public.grade_groups enable row level security;

create policy "Faculty manage own groups" on public.grade_groups
  using  (auth.uid() = created_by)
  with check (auth.uid() = created_by);

create policy "Authenticated read groups" on public.grade_groups
  for select using (auth.role() = 'authenticated');


-- ---------------------------------------------------------------
-- PHASE 1B: Extend grade_columns with nullable new fields
--   - group_id      nullable FK → grade_groups
--   - entry_type    nullable text  ('manual' | 'quiz_linked')
--   - linked_quiz_id nullable FK → quizzes
-- Note: category column is NOT touched — old frontend still uses it.
-- ---------------------------------------------------------------

alter table public.grade_columns
  add column if not exists group_id        uuid references public.grade_groups(id) on delete set null,
  add column if not exists entry_type      text check (entry_type in ('manual', 'quiz_linked')),
  add column if not exists linked_quiz_id  uuid references public.quizzes(id) on delete set null;


-- ---------------------------------------------------------------
-- PHASE 2A: Seed 5 default grade groups for every faculty account
-- Groups: Quizzes 15%, Laboratory 25%, Assignments 20%,
--         Project 15%, Exam 25%  (total = 100%)
-- ON CONFLICT DO NOTHING so re-running is safe.
-- ---------------------------------------------------------------

insert into public.grade_groups (name, weight_percent, created_by)
select
  grp.name,
  grp.weight_percent,
  p.id
from public.profiles p
cross join (values
  ('Quizzes',     15),
  ('Laboratory',  25),
  ('Assignments', 20),
  ('Project',     15),
  ('Exam',        25)
) as grp(name, weight_percent)
where p.role = 'faculty'
on conflict (created_by, name) do nothing;


-- ---------------------------------------------------------------
-- PHASE 2B: Migrate existing grade_columns rows into groups
--   category = 'lab'        → Laboratory group
--   category = 'assignment' → Assignments group
-- Only sets group_id where it is still NULL (idempotent).
-- ---------------------------------------------------------------

-- lab → Laboratory
update public.grade_columns gc
set
  group_id   = gg.id,
  entry_type = 'manual'
from public.grade_groups gg
where gc.created_by    = gg.created_by
  and gc.category      = 'lab'
  and gg.name          = 'Laboratory'
  and gc.group_id      is null;

-- assignment → Assignments
update public.grade_columns gc
set
  group_id   = gg.id,
  entry_type = 'manual'
from public.grade_groups gg
where gc.created_by    = gg.created_by
  and gc.category      = 'assignment'
  and gg.name          = 'Assignments'
  and gc.group_id      is null;


-- ---------------------------------------------------------------
-- PHASE 2C: Inspection queries
-- Run these manually after the migration to verify correctness.
-- They are wrapped in comments so they don't execute automatically.
-- ---------------------------------------------------------------

/*

-- 1. Check all faculty have exactly 5 groups
select created_by, count(*) as group_count
from public.grade_groups
group by created_by;
-- Expected: each faculty row shows count = 5

-- 2. Check group weights sum to 100 per faculty
select created_by, sum(weight_percent) as total_weight
from public.grade_groups
group by created_by;
-- Expected: each row shows total_weight = 100

-- 3. Check every old grade_column now has a group_id
select id, title, category, group_id, entry_type
from public.grade_columns
where group_id is null;
-- Expected: 0 rows (all old columns migrated)

-- 4. Spot-check migrated columns joined to their group names
select
  gc.title,
  gc.category,
  gg.name as group_name,
  gc.entry_type
from public.grade_columns gc
left join public.grade_groups gg on gg.id = gc.group_id
order by gc.created_at;

-- 5. Confirm grade_entries are untouched (spot check)
select count(*) from public.grade_entries;

*/
