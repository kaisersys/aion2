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

## Item-level economy regression and live checks

- A full 0x1156 snapshot establishes baseline stack counts and must not create purchases.
- A known 0x1B56 stack increase or decrease yields only item ID, signed quantity, time, and random local capture-session ID.
- A new unknown stack without full inventory baseline must not fabricate a gain.
- A single item added near a Kina debit can be labeled possible purchase, never verified market purchase.
- Two item types acquired together must remain ambiguous; one item event cannot be assigned twice.
- Consumed items are not mistaken for purchases, and delayed Market settlement is not assigned to an old item removal.
- Verify character/capture session switches, malformed padding and duplicate stack updates.
- Verify website synchronization skips item_change and no raw handles or packet bytes are stored.
- Verify 531060004 displays Courage Scroll (Bound); unknown IDs remain readable.


## Ground-pickup source decoding (local-only)

- On a normal login capture a full inventory baseline and confirm Tracked inventory stacks > 0.
- After picking up a known ground drop, check that Ground drops observed and Own ground pickups increase; when a matching inventory increase arrives, Ground pickups matched should rise.
- In Overview, a corroborated ground pickup appears by item and quantity. Even if Kina changes within 4.5 seconds, the proven pickup must **not** appear under Possible purchases.
- A pickup by someone else, disappearing ground item, dropped item not added to inventory, or missing pickup message must stay unverified.
- Test inventory before and after ground-disappearance, and a delay beyond 1.5 seconds; only an exact one-to-one item/quantity match qualifies.
- If a Market purchase, NPC buy, craft or storage transfer happens, do **not** infer its transaction source from a nearby wallet or item change. Market order receipts remain unsupported.
- Diagnostics show counts only. Never share unredacted traffic, authentication data, packet payloads, inventory handles or IP addresses.
