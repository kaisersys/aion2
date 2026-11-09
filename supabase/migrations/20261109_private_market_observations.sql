-- Atreia Street: private personal Market observations from game-window OCR.
-- Apply manually in Supabase SQL Editor after player character tables.
-- No public access, service role not used by the desktop app.
create table if not exists public.player_market_observations (
 user_id uuid not null,
 character_id uuid not null,
 fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
 kind text not null check (kind in (
   'listing_preview','listing_confirmed_screen','settlement_visible',
   'settlement_claimed_screen','purchase_preview')),
 item_name text not null check (char_length(item_name) between 2 and 80),
 quantity bigint not null check (quantity between 1 and 1000000000),
 unit_price bigint check (unit_price between 1 and 100000000000000),
 gross bigint check (gross between 1 and 100000000000000),
 listing_fee bigint check (listing_fee between 1 and 100000000000000),
 proceeds bigint check (proceeds between 1 and 100000000000000),
 currency_kind text not null default 'unbound' check (currency_kind = 'unbound'),
 evidence text not null default 'screen_observed' check(evidence='screen_observed'),
 occurred_at timestamptz not null,
 recorded_at timestamptz not null default now(),
 primary key(user_id,character_id,fingerprint),
 foreign key(user_id,character_id)
  references public.player_characters(user_id,id) on delete cascade,
 constraint market_screen_shape check (
   (kind like 'listing%' and listing_fee is not null
     and (unit_price is not null or gross is not null) and proceeds is null)
   or (kind like 'settlement%' and proceeds is not null and listing_fee is null)
   or (kind='purchase_preview' and
     (unit_price is not null or gross is not null) and listing_fee is null and proceeds is null)
 )
);
create index if not exists market_observations_by_character
 on public.player_market_observations(user_id,character_id,occurred_at desc);
alter table public.player_market_observations enable row level security;
revoke all on public.player_market_observations from public,anon,authenticated;
grant select,insert,delete on public.player_market_observations to authenticated;
drop policy if exists "Select own private market observations" on public.player_market_observations;
create policy "Select own private market observations" on public.player_market_observations
 for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "Insert own private market observations" on public.player_market_observations;
create policy "Insert own private market observations" on public.player_market_observations
 for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists "Delete own private market observations" on public.player_market_observations;
create policy "Delete own private market observations" on public.player_market_observations
 for delete to authenticated using (user_id=(select auth.uid()));
-- Observations are not verified purchases/sales, listing fee debits,
-- or received gross revenue. They are OCR readings of UI fields.
