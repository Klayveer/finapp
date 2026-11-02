-- FinApp · schema do Supabase
-- Cole tudo no SQL Editor do seu projeto e clique em "Run".

create table if not exists public.records (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  kind       text not null check (kind in ('cards', 'transactions', 'settings')),
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.records enable row level security;

drop policy if exists "records_select_own" on public.records;
drop policy if exists "records_insert_own" on public.records;
drop policy if exists "records_update_own" on public.records;
drop policy if exists "records_delete_own" on public.records;

create policy "records_select_own" on public.records
  for select using (auth.uid() = user_id);
create policy "records_insert_own" on public.records
  for insert with check (auth.uid() = user_id);
create policy "records_update_own" on public.records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "records_delete_own" on public.records
  for delete using (auth.uid() = user_id);
