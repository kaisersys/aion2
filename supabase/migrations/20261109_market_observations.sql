-- Account-owned, structured Market OCR observations. No images, OCR text dumps,
-- screen coordinates, raw packets, or public select policies.
create table if not exists public.player_market_observations (
 user_id uuid not null,
 character_id uuid not null,
 observation_id uuid not null,
 occurred_at timestamptz not null,
 kind text not null check(kind in ('listing_observation','settlement_observation')),
 amount bigint not null check(amount between 1 and 100000000000000),
 fee bigint check(fee between 1 and 100000000000000),
 quantity bigint check(quantity between 1 and 1000000),
 item_name text check(item_name is null or
   (char_length(item_name) between 2 and 80 and item_name !~ '[[:cntrl:]]')),
 evidence text not null check(evidence='screen_ocr'),
 status text not null default 'unverified' check(status='unverified'),
 recorded_at timestamptz not null default now(),
 primary key(user_id,observation_id),
 foreign key(user_id,character_id)
  references public.player_characters(user_id,id) on delete cascade,
 constraint listing_fee_required check(kind<>'listing_observation' or fee is not null),
 constraint settlement_fee_absent check(kind<>'settlement_observation' or fee is null)
);
create index if not exists player_market_observations_owner_time
 on public.player_market_observations(user_id,occurred_at desc);
alter table public.player_market_observations enable row level security;
revoke all on public.player_market_observations from public,anon,authenticated;
grant select,insert on public.player_market_observations to authenticated;
drop policy if exists "Account reads own Market observations" on public.player_market_observations;
create policy "Account reads own Market observations"
 on public.player_market_observations for select to authenticated
 using (user_id=(select auth.uid()));
drop policy if exists "Account inserts own Market observations" on public.player_market_observations;
create policy "Account inserts own Market observations"
 on public.player_market_observations for insert to authenticated
 with check(user_id=(select auth.uid()));
comment on table public.player_market_observations is
 'Private account-owned OCR observations; not proof of completed Market transactions.';
