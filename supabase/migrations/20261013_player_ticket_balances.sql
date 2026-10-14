-- Atreia Street · per-player banked ticket balances
-- Apply after 20261013_character_dashboard.sql in Supabase SQL Editor.
-- Additive migration: existing account, character, checklist and guide data stay intact.
create table if not exists public.player_ticket_balances(
 user_id uuid not null references auth.users(id) on delete cascade,
 owner_scope text not null check(owner_scope in ('character','server')),
 owner_key text not null check(length(owner_key) between 1 and 48),
 task_key text not null check(task_key ~ '^[a-z0-9-]{1,90}$'),
 balance integer not null check(balance between 0 and 100000),
 anchor_reset date not null,
 updated_at timestamptz not null default now(),
 primary key(user_id,owner_scope,owner_key,task_key)
);
create index if not exists player_ticket_balances_user on public.player_ticket_balances(user_id);
alter table public.player_ticket_balances enable row level security;
revoke all on public.player_ticket_balances from anon,authenticated;
grant select,insert,update,delete on public.player_ticket_balances to authenticated;

-- Users can only store balances for their own characters or servers.
create or replace function public.owns_ticket_balance_owner(scope text,owner text)
returns boolean
language sql stable security definer set search_path=''
as $$
 select case
   when scope='character' then exists (
     select 1 from public.player_characters
     where user_id=(select auth.uid()) and id::text=owner
   )
   when scope='server' then exists (
     select 1 from public.player_characters
     where user_id=(select auth.uid()) and server_name=owner
   )
   else false end
$$;
revoke all on function public.owns_ticket_balance_owner(text,text) from public;
grant execute on function public.owns_ticket_balance_owner(text,text) to authenticated;

drop policy if exists "Players view own balances" on public.player_ticket_balances;
create policy "Players view own balances" on public.player_ticket_balances
 for select to authenticated
 using (user_id=(select auth.uid()));
drop policy if exists "Players create own balances" on public.player_ticket_balances;
create policy "Players create own balances" on public.player_ticket_balances
 for insert to authenticated
 with check(user_id=(select auth.uid()) and public.owns_ticket_balance_owner(owner_scope,owner_key));
drop policy if exists "Players update own balances" on public.player_ticket_balances;
create policy "Players update own balances" on public.player_ticket_balances
 for update to authenticated
 using(user_id=(select auth.uid()))
 with check(user_id=(select auth.uid()) and public.owns_ticket_balance_owner(owner_scope,owner_key));
drop policy if exists "Players delete own balances" on public.player_ticket_balances;
create policy "Players delete own balances" on public.player_ticket_balances
 for delete to authenticated
 using(user_id=(select auth.uid()));
-- No impact to admin_users or public guides. No service key in the browser.
