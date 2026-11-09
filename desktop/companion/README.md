# Atreia Street Companion (Windows MVP)

A lightweight, **local-first character economy and daily/weekly summary** for the existing Atreia Street site. No DPS meter, combat overlay, injection, or modification of the game.

## Status — important

This is a **working desktop dashboard and sync scaffold**, not yet a verified live Npcap capture client. It accepts manual entries and an append-only, *already decoded* JSONL event feed. **Npcap connection, Aion 2 stream reassembly, and Kinah transaction message decoding are NOT implemented in this version.** Do not advertise it as automatic in-game tracking until real captured data has been validated.

The verified ticket-message research in MIT-licensed community projects is promising; the actual capture adapter must associate a login's ticket snapshots with the correct character and verify opcode coverage for Global. The Kinah earned/spent ledger must be based on independently observed transactions or explicitly marked estimates, never inferred from net wallet changes.

## Windows development

Requirements: Node 22+, Windows 10/11.

1. From this folder run npm install, then npm start.
2. Add or select a character (exact character name + server).
3. Use **Record entry** to test Kinah events and counter snapshots, or select a JSONL feed emitted by a compatible, separately developed decoder.
4. Events are kept in your Electron user data directory as local-ledger.json. No credentials or raw packet captures are stored.
5. When ready to sync, copy config.example.json to config.json and set the **existing website's** Supabase URL and publishable anon key. These are not service-role secrets. Run the additive migration supabase/migrations/20261108_companion_telemetry.sql in Supabase first.
6. Sign in with your existing website account and press **Sync progress**. The desktop app matches by character name and server to your website's player_characters table.

Run tests with npm test. Build a Windows installer with npm run dist:win (or the manual companion workflow). No installer has been produced or published by this commit.

## Decoder JSONL contract

Each newline is a complete JSON object with these common fields:
- id: stable event identifier for idempotent imports (if omitted, the local importer hashes the file, line index and contents)
- character: exact in-game character name
- server: exact website server name
- occurred_at: ISO 8601 timestamp (UTC recommended)
- source: decoded or manual; only trusted decoders should emit decoded

Kinds:
- Kinah income: type=kinah_earned, amount=positive integer
- Kinah expense: type=kinah_spent, amount=positive integer
- Current wallet: type=wallet_snapshot, balance=nonnegative integer
- Daily/weekly counter: type=counter, key=website task key, frequency=daily|weekly, scope=character|server, current=number, maximum=number

An example is in samples/events.jsonl. It uses **fictional values**. To test it, create the fictional character named Example Daeva on Example Server in the app and select the example feed. Production decoders must never fabricate or guess event identifiers, amounts, or transaction directions.

The feeder is polled every 2 seconds, capped at 8 MB. If a feed grows beyond that, rotate it and reselect a smaller file. Malformed and partial lines are ignored. This is deliberately not a raw PCAP importer.

## Cloud storage & privacy

The app keeps local history even without a website login. Website login is only in memory; its password is not persisted. Sync is explicit/opt-in, and uses the existing authenticated Supabase RLS. The additive player_companion_events table stores derived events, not raw packets, network addresses, chat, or game credentials. Decoder-originated ticket snapshots may also update the existing player_ticket_balances table; manually entered counters never overwrite those balances. No service-role key is shipped.

The app's website character names and server names must match exactly (ignoring case); mismatched records remain local and are reported as unmatched after sync. Website analysis UI is deliberately not part of this MVP.

## Licensing and account risk

Npcap is **not bundled**. Its free license does not permit redistribution of its installer; users who later opt into the capture integration would need to install it from npcap.com, subject to its terms. Third-party game traffic inspection remains unofficial and may violate NCSOFT rules or expose accounts to sanctions. This prototype does not read game traffic.

## Next technical milestone

Build and validate the actual read-only capture adapter using independently vetted protocol-decoding code. Start with Aion 2 ticket list/update messages (0x0b61/0x0c61) and character identity; map to existing website checklist keys. Research complete Kinah income/spend event coverage *before* enabling automatic economic totals. Ship a preview channel before general release.
