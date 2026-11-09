-- Atreia Street Companion · local-derived economy and progression events.
-- Apply after 20261013_character_dashboard.sql. No administrator privileges.
-- Store individual derived readings for future site analytics, not raw packets.
create table if not exists public.player_companion_events (
  user_id uuid not null,
  character_id uuid not null,
  event_hash text not null check (event_hash ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('kinah_earned','kinah_spent','wallet_snapshot','counter')),
  source text not null check (source in ('decoded','manual')),
  occurred_at timestamptz not null,
  amount bigint check (amount between 0 and 100000000000000),
  balance bigint check (balance between 0 and 100000000000000),
  currency_kind text check (currency_kind in ('bound')),
  counter_key text check (counter_key ~ '^[a-z0-9-]{1,90}$'),
  counter_frequency text check (counter_frequency in ('daily','weekly')),
  counter_scope text check (counter_scope in ('character','server')),
  counter_current bigint check (counter_current between 0 and 1000000),
  counter_maximum bigint check (counter_maximum between 0 and 1000000),
  recorded_at timestamptz not null default now(),
  primary key (user_id,character_id,event_hash),
  foreign key (user_id,character_id) references public.player_characters(user_id,id) on delete cascade,
  constraint companion_event_shape check (
    (kind in ('kinah_earned','kinah_spent') and amount is not null and amount > 0
       and balance is null and counter_key is null)
    or (kind='wallet_snapshot' and balance is not null
       and amount is null and counter_key is null)
    or (kind='counter' and counter_key is not null
       and counter_current is not null and counter_maximum is not null
       and counter_current <= counter_maximum
       and counter_frequency is not null and counter_scope is not null
       and amount is null and balance is null)
  )
);
create index if not exists companion_events_user_time
  on public.player_companion_events(user_id,occurred_at desc);
create index if not exists companion_events_character_kind_time
  on public.player_companion_events(character_id,kind,occurred_at desc);
alter table public.player_companion_events enable row level security;
revoke all on public.player_companion_events from anon,authenticated;
grant select,insert on public.player_companion_events to authenticated;

drop policy if exists "Players read own companion events" on public.player_companion_events;
create policy "Players read own companion events" on public.player_companion_events
  for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "Players insert own companion events" on public.player_companion_events;
create policy "Players insert own companion events" on public.player_companion_events
  for insert to authenticated with check (user_id=(select auth.uid()));

-- Existing player_ticket_balances and checklist tables retain their existing RLS.
-- This is a player-reported ledger, not verified official game transactions.
