-- Atreia Street player accounts (run once in Supabase SQL Editor).
-- This migration only adds player-owned tables. It does NOT change admin
-- permissions, the guides table, or public guide visibility.
-- Visitors sign up through Supabase Auth. Database RLS, not UI, enforces
-- that every user can only read and update their own tracking data.

create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Daeva' check (char_length(display_name) between 1 and 40),
  class_name text not null default '' check (char_length(class_name) <= 40),
  faction text not null default '' check (faction in ('','Elyos','Asmodian')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.player_profiles enable row level security;
revoke all on public.player_profiles from anon, authenticated;
grant select, insert, update, delete on public.player_profiles to authenticated;

drop policy if exists "Players read own profile" on public.player_profiles;
create policy "Players read own profile" on public.player_profiles
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Players create own profile" on public.player_profiles;
create policy "Players create own profile" on public.player_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Players update own profile" on public.player_profiles;
create policy "Players update own profile" on public.player_profiles
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists "Players delete own profile" on public.player_profiles;
create policy "Players delete own profile" on public.player_profiles
  for delete to authenticated using (user_id = (select auth.uid()));

create table if not exists public.player_task_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_key text not null check (char_length(task_key) between 1 and 100),
  period_start date not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, task_key, period_start)
);
create index if not exists player_task_completions_recent
  on public.player_task_completions (user_id, period_start desc);
alter table public.player_task_completions enable row level security;
revoke all on public.player_task_completions from anon, authenticated;
grant select, insert, delete on public.player_task_completions to authenticated;

drop policy if exists "Players read own checklist" on public.player_task_completions;
create policy "Players read own checklist" on public.player_task_completions
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Players complete own tasks" on public.player_task_completions;
create policy "Players complete own tasks" on public.player_task_completions
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Players uncheck own tasks" on public.player_task_completions;
create policy "Players uncheck own tasks" on public.player_task_completions
  for delete to authenticated using (user_id = (select auth.uid()));

create table if not exists public.player_saved_guides (
  user_id uuid not null references auth.users(id) on delete cascade,
  guide_slug text not null check (guide_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  saved_at timestamptz not null default now(),
  primary key (user_id, guide_slug)
);
alter table public.player_saved_guides enable row level security;
revoke all on public.player_saved_guides from anon, authenticated;
grant select, insert, delete on public.player_saved_guides to authenticated;

drop policy if exists "Players read own bookmarks" on public.player_saved_guides;
create policy "Players read own bookmarks" on public.player_saved_guides
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Players save own guides" on public.player_saved_guides;
create policy "Players save own guides" on public.player_saved_guides
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Players remove own bookmarks" on public.player_saved_guides;
create policy "Players remove own bookmarks" on public.player_saved_guides
  for delete to authenticated using (user_id = (select auth.uid()));

-- IMPORTANT: Do not add players to public.admin_users. This migration never
-- grants insert/update/delete on public.guides to non-admin accounts.
