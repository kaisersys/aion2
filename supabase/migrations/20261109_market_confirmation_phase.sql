-- Account-owned classification of Market OCR screen state.
-- Confirmation is a prompt observation, not proof of server-side listing.
alter table public.player_market_observations
 add column if not exists screen_phase text;
alter table public.player_market_observations
 drop constraint if exists player_market_observations_screen_phase_check;
alter table public.player_market_observations
 add constraint player_market_observations_screen_phase_check
 check(screen_phase is null or screen_phase in ('listing_form','confirmation','settlement'));
comment on column public.player_market_observations.screen_phase is
 'User-visible screen state only: listing_form, confirmation prompt, or settlement; not server acceptance.';
