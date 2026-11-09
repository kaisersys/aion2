# Atreia Street Companion (Windows MVP)

A lightweight, **local-first character economy and daily/weekly summary** for the existing Atreia Street site. No DPS meter, combat overlay, injection, or modification of the game.

## Status — important

This version now integrates a **read-only Npcap capture helper** with TCP stream reconstruction and a decoder for Aion 2 character identity and game-reported daily/weekly ticket snapshots. You can click **Start Npcap capture**. The implementation is newly written and **has not been proven against a live Aion 2 Global session**; it has a small protocol parser self-test based on synthetic fixtures. Real game traffic is necessary to validate port differences, decoder coverage, character matching, and reset behavior before public release.

**Kinah: only the known bound-Kinah item (ID 930100001) is decoded into a labeled balance snapshot**. Total Kinah, gross Kinah earned and gross Kinah spent are NOT automatically decoded yet. Manual economic entries remain available for testing and corrections. Do not treat bound-Kinah snapshots as full wallet totals or infer earnings/spending from changes in net wallet balance.

The verified ticket-message research in MIT-licensed community projects is promising; the actual capture adapter must associate a login's ticket snapshots with the correct character and verify opcode coverage for Global. The Kinah earned/spent ledger must be based on independently observed transactions or explicitly marked estimates, never inferred from net wallet changes.

## Windows development

Requirements: Node 22+, .NET 10 SDK for development, Windows 10/11, and Npcap installed separately from npcap.com for live capture.

1. From this folder run `npm install`, `npm run capture:build`, then `npm start`.
2. Add or select a character (exact character name + server).
3. Click **Start Npcap capture**, then fully log out and back into your Aion 2 character. The helper defaults to TCP game-server port 13328 as documented for EU; the Global release may use a different port (you can change it in the app). Or use **Record entry** for manual testing / **JSONL test feed** for verified externally decoded events.
4. Events are kept in your Electron user data directory as local-ledger.json. No credentials or raw packet captures are stored.
5. When ready to sync, copy config.example.json to config.json and set the **existing website's** Supabase URL and publishable anon key. These are not service-role secrets. Run the additive migration supabase/migrations/20261108_companion_telemetry.sql in Supabase first.
6. Sign in with your existing website account and press **Sync progress**. The desktop app matches by character name and server to your website's player_characters table.

Run parser self-tests with `dotnet run --project capture/AtreiaCapture.csproj -- --self-test` and app tests with `npm test`. Build a Windows installer with `npm run capture:build` then `npm run dist:win` (or the Windows preview workflow). Npcap is never bundled. Installers are published as a GitHub Actions preview artifact only, not a public production release.

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

The app only captures inbound TCP payloads on the selected Aion 2 server port, with no raw packet files or network addresses uploaded. The app keeps local history even without a website login. Website login is only in memory; its password is not persisted. Sync is explicit/opt-in, and uses the existing authenticated Supabase RLS. The additive player_companion_events table stores derived events, not raw packets, network addresses, chat, or game credentials. Decoder-originated ticket snapshots may also update the existing player_ticket_balances table; manually entered counters never overwrite those balances. No service-role key is shipped.

The app's website character names and server names must match exactly (ignoring case); mismatched records remain local and are reported as unmatched after sync. Website analysis UI is deliberately not part of this MVP.

## Licensing and account risk

Npcap is **not bundled**. Its free license does not permit redistribution of its installer; users who opt into the capture integration must separately install it from npcap.com, subject to its terms. The decoder is based on public MIT-licensed research from SkeeveTV's Aion-DPS-Meter with attribution under `capture/THIRD-PARTY-NOTICES.md`. Third-party game traffic inspection remains unofficial and may violate NCSOFT rules or expose accounts to sanctions. The helper is strictly passive and does not inject code, alter memory, or transmit game commands.

## Next technical milestone

Validate against a real Global login and controlled task changes, including ticket list/update messages (`0x0b61` / `0x0c61`), local character frame (`0x3336`), and bound Kinah inventory snapshots (`0x1156` / `0x1b56`). Confirm packet port, correct name/server identity, and expected values before changing website checkmarks. Research *complete* Kinah income/spend event coverage before enabling automatic gross economic totals. The current reader does not decode nested LZ4 bundles, so coverage can be incomplete.
