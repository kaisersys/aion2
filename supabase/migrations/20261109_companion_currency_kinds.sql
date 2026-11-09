-- Atreia Street Companion: distinguish tradable and bound Kina in derived wallet snapshots.
-- Safe for an already-installed 20261108 companion telemetry table.
-- No untrusted game-packet data or individual transaction attribution is added.
ALTER TABLE public.player_companion_events
  ADD COLUMN IF NOT EXISTS currency_kind text;

ALTER TABLE public.player_companion_events
  DROP CONSTRAINT IF EXISTS player_companion_events_currency_kind_check;
ALTER TABLE public.player_companion_events
  ADD CONSTRAINT player_companion_events_currency_kind_check
  CHECK (currency_kind IS NULL OR currency_kind IN ('bound','unbound'));

COMMENT ON COLUMN public.player_companion_events.currency_kind IS
  'Currency classification for wallet snapshots: bound or tradable (unbound). NULL = legacy unknown. Wallet snapshots are balances, not gross earned/spent transactions.';
