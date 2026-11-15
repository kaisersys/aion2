-- Make screen-read listing fees visible even when OCR cannot read the asking
-- price. Corroboration requires a separate, matching observed Kinah debit.
-- Account ownership remains enforced for SELECT, INSERT, and UPDATE.
alter table public.player_market_observations
 drop constraint if exists player_market_observations_kind_check;
alter table public.player_market_observations
 add constraint player_market_observations_kind_check
 check(kind in ('listing_observation','listing_fee_observation','settlement_observation'));
alter table public.player_market_observations
 drop constraint if exists player_market_observations_status_check;
alter table public.player_market_observations
 add constraint player_market_observations_status_check
 check(status in ('unverified','corroborated'));
alter table public.player_market_observations
 add column if not exists currency_kind text;
alter table public.player_market_observations
 drop constraint if exists player_market_observations_currency_kind_check;
alter table public.player_market_observations
 add constraint player_market_observations_currency_kind_check
 check(currency_kind is null or currency_kind in ('bound','unbound','mixed'));
alter table public.player_market_observations
 add constraint market_fee_only_shape
 check(kind<>'listing_fee_observation' or (fee is not null and amount=fee));
alter table public.player_market_observations
 add constraint market_fee_corroboration_shape
 check(
  (status='unverified' and currency_kind is null)
  or (status='corroborated' and kind<>'settlement_observation'
      and fee is not null and currency_kind is not null)
 );
grant update on public.player_market_observations to authenticated;
drop policy if exists "Account updates own Market observations"
 on public.player_market_observations;
create policy "Account updates own Market observations"
 on public.player_market_observations for update to authenticated
 using(user_id=(select auth.uid()))
 with check(user_id=(select auth.uid()));
