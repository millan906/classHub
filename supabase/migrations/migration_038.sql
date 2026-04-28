-- Server-side login rate limiting table
-- Accessed only by the login edge function via service role key.
-- RLS is enabled so the anon key cannot read or write this table directly.
-- Service role bypasses RLS automatically — no policy needed for the edge function.

create table if not exists login_rate_limits (
  email        text primary key,
  attempts     int          not null default 0,
  locked_until timestamptz,
  tier         int          not null default 0,
  updated_at   timestamptz  not null default now()
);

-- Auto-clean rows older than 24 hours so the table doesn't grow unbounded.
-- Runs as a cron job (set up in Supabase dashboard) or just left for pg_cron.
-- Index to make the cleanup query fast.
alter table login_rate_limits enable row level security;
-- No policies — service role (used by the edge function) bypasses RLS entirely.
-- Anon and authenticated clients have zero access.

create index if not exists login_rate_limits_updated_at_idx on login_rate_limits (updated_at);
 