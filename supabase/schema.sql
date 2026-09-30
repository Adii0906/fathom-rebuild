-- Run once in the Supabase SQL editor. The app talks to this table server-side
-- with the service-role key, so RLS stays on and no public policies are added.
create table if not exists public.kv (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);
alter table public.kv enable row level security;
