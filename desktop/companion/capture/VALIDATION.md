undefined
## Verify regular Kina updates (not just bound currency)

1. Run the updated companion, fully enter a character, and note inventory packet count and both wallet-reading counters.
2. Open the game Cube currency display: record **Kina** (tradeable) and **Kina (Bound)** individually. Compare these to the dashboard values. "Kina (All)" is their sum, never a separate wallet.
3. Defeat one ordinary monster that actually grants regular Kina. Compare the observed regular-wallet reading counter, balance and net since first reading. A balance increase is not automatically a verified kill-income transaction.
4. If unbound wallet readings remain zero while bound wallet readings increase, the live Global game client uses a currency update path our inventory decoder does not yet understand. Report only those counters, not raw traffic.
5. If a regular wallet update arrives but the displayed balance does not match the game, pause testing and report the observed vs in-game amounts. Do not use this beta to make financial decisions about in-game trading.


## Overview / Diagnostics and observed economic movement tests

- Confirm initial app opens the **Overview** tab with no Npcap/opcode counters visible. Switch to **Diagnostics** and confirm those counters and capture start/pause/port options appear; switch back while the helper continues running.
- Verify a regular-Kina balance baseline is not recorded as income. The second changed balance within the same capture session should generate an *observed*, *source-unknown* In or Out row (never a "market sale" or "purchase" event).
- Verify a bound-Kina outflow and regular-Kina outflow are counted independently. The overall In and Out totals are sums of recorded positive and negative deltas, not simply a net difference.
- Stop/restart the capture helper or switch characters and verify the first balance on the new session is only a baseline, even if it differs substantially from the previous session.
- Verify no fabricated movement across more than 20 minutes without a qualifying reading, nor from old/manual records without a known decode session.
- A claimed market settlement may appear as a regular-Kina increase, but **cause attribution is not supported**. If exact gains / gross sales / buy-item names are required, a separately verified transaction packet mapping must be implemented and tested.
