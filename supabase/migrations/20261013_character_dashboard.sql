-- Atreia Street · multi-character daily/weekly tracking
-- Run in the existing Supabase SQL Editor after 20261013_player_accounts.sql.
-- Additive migration: preserves player_profiles, previous checklist rows,
-- saved guides and Guide Studio permissions.

create table if not exists public.player_characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  class_name text not null default '' check (char_length(class_name) <= 40),
  faction text not null default '' check (faction in ('','Elyos','Asmodian')),
  server_name text not null default 'My server' check (char_length(trim(server_name)) between 1 and 48),
  backdrop text not null default 'violet' check (backdrop in ('violet','frost','ember')),
  is_main boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id,id)
);
create unique index if not exists player_one_main_per_user
  on public.player_characters (user_id) where (is_main);
create index if not exists player_characters_order
  on public.player_characters (user_id,created_at,id);

alter table public.player_characters enable row level security;
revoke all on public.player_characters from anon, authenticated;
grant select,insert,update,delete on public.player_characters to authenticated;

drop policy if exists "Players read own characters" on public.player_characters;
create policy "Players read own characters" on public.player_characters
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Players create own characters" on public.player_characters;
create policy "Players create own characters" on public.player_characters
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Players update own characters" on public.player_characters;
create policy "Players update own characters" on public.player_characters
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists "Players delete own characters" on public.player_characters;
create policy "Players delete own characters" on public.player_characters
  for delete to authenticated using (user_id = (select auth.uid()));

-- Bring existing players' character information into an initial main tab.
-- Idempotent: repeated migration runs never create a second main character.
insert into public.player_characters
  (user_id,name,class_name,faction,server_name,backdrop,is_main)
select p.user_id,left(p.display_name,40),p.class_name,p.faction,'My server','violet',true
from public.player_profiles p
where not exists (
  select 1 from public.player_characters c where c.user_id=p.user_id and c.is_main
)
on conflict do nothing;

create table if not exists public.player_character_task_completions (
  user_id uuid not null,
  character_id uuid not null,
  task_key text not null check (char_length(task_key) between 1 and 100),
  period_start date not null,
  completed_at timestamptz not null default now(),
  primary key(user_id,character_id,task_key,period_start),
  foreign key (user_id,character_id) references public.player_characters(user_id,id) on delete cascade
);
create index if not exists player_character_ticks_period
  on public.player_character_task_completions(user_id,period_start);
alter table public.player_character_task_completions enable row level security;
revoke all on public.player_character_task_completions from anon, authenticated;
grant select,insert,delete on public.player_character_task_completions to authenticated;

drop policy if exists "Players read own character ticks" on public.player_character_task_completions;
create policy "Players read own character ticks" on public.player_character_task_completions
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Players complete own character tasks" on public.player_character_task_completions;
create policy "Players complete own character tasks" on public.player_character_task_completions
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Players uncheck own character tasks" on public.player_character_task_completions;
create policy "Players uncheck own character tasks" on public.player_character_task_completions
  for delete to authenticated using (user_id = (select auth.uid()));

-- Shared server-wide limits are stored separately: ticking Duty Missions on an
-- alt should also tick them on the main *when both are on the same server*.
create table if not exists public.player_server_task_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  server_name text not null check (char_length(trim(server_name)) between 1 and 48),
  task_key text not null check (char_length(task_key) between 1 and 100),
  period_start date not null,
  completed_at timestamptz not null default now(),
  primary key(user_id,server_name,task_key,period_start)
);
alter table public.player_server_task_completions enable row level security;
revoke all on public.player_server_task_completions from anon, authenticated;
grant select,insert,delete on public.player_server_task_completions to authenticated;

drop policy if exists "Players read own server ticks" on public.player_server_task_completions;
create policy "Players read own server ticks" on public.player_server_task_completions
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Players complete own server tasks" on public.player_server_task_completions;
create policy "Players complete own server tasks" on public.player_server_task_completions
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Players uncheck own server tasks" on public.player_server_task_completions;
create policy "Players uncheck own server tasks" on public.player_server_task_completions
  for delete to authenticated using (user_id = (select auth.uid()));

-- Preserve legacy checklist records (the earlier version's generic task keys)
-- on the initial main character; old tables remain untouched.
insert into public.player_character_task_completions
  (user_id,character_id,task_key,period_start,completed_at)
select old.user_id,c.id,old.task_key,old.period_start,old.completed_at
from public.player_task_completions old
join public.player_characters c on c.user_id=old.user_id and c.is_main
on conflict do nothing;

-- RLS on public.guides and admin_users remains unchanged. Never grant a
-- newly signed-up player membership in public.admin_users.
