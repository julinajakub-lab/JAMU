-- Společenstvo Inscenace: database setup.
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

-- Photo storage: a private bucket only logged-in gang members can see and use.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "gang reads photos" on storage.objects;
create policy "gang reads photos" on storage.objects
  for select to authenticated using (bucket_id = 'photos');

drop policy if exists "gang uploads photos" on storage.objects;
create policy "gang uploads photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');

drop policy if exists "gang deletes photos" on storage.objects;
create policy "gang deletes photos" on storage.objects
  for delete to authenticated using (bucket_id = 'photos');
