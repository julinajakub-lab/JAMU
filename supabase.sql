-- JAMU Survivors' Club: database setup.
-- Paste this whole file into Supabase → SQL Editor → New query, then press "Run".

create table if not exists public.records (
  id          uuid primary key default gen_random_uuid(),
  collection  text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists records_collection_idx on public.records (collection);

-- Only people who logged in with the group password can read or change anything.
alter table public.records enable row level security;

drop policy if exists "gang can do everything" on public.records;
create policy "gang can do everything" on public.records
  for all to authenticated
  using (true) with check (true);
