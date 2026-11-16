# Atreia Street Companion (Windows MVP)

A lightweight, **local-first character economy and daily/weekly summary** for the existing Atreia Street site. No DPS meter, combat overlay, injection, or modification of the game.

## Status — important

This version integrates a **read-only Npcap capture helper** with TCP stream reconstruction and a decoder for Aion 2 character identity and game-reported daily/weekly ticket snapshots. **Capture automatically starts when the companion opens** (unless the user previously paused it). The Windows driver still needs to be installed separately. The implementation is newly written and **has not been proven against a live Aion 2 Global session**; it has a small protocol parser self-test based on synthetic fixtures. Real game traffic is necessary to validate port differences, decoder coverage, character matching, and reset behavior before public release.

**Kinah: ordinary/tradable Kina (Global item ID 930100031) and bound Kina (observed inventory item ID 930100001) are now decoded into separate labeled balance snapshots.** When both are observed, a combined balance is calculated locally. The "Regular net today" field is the change from the first observed unbound balance after the 07:00 UTC reset; it is NOT gross income from kills. Gross Kinah earned/spent are only available when explicit transaction events are supplied (e.g. manual entry); **do not treat inventory deltas as gross earnings or expenditures**. Live verification of ID 930100031 in Global inventory packets is required.

The verified ticket-message research in MIT-licensed community projects is promising; the actual capture adapter must associate a login's ticket snapshots with the correct character and verify opcode coverage for Global. The Kinah earned/spent ledger must be based on independently observed transactions or explicitly marked estimates, never inferred from net wallet changes.

## Windows development

Requirements: Node 22+, .NET 10 SDK for development, Windows 10/11, and Npcap installed separately from npcap.com for live capture.

1. From this folder run `npm install`, `npm run capture:build`, then `npm start`.
2. Open Atreia Street Companion. **Npcap tracking starts automatically on app startup** when Npcap is installed. If Npcap is missing, the main window reports an error instead of crashing; install the driver separately from npcap.com.
3. Log into Aion 2. When the local character record is received, the character is automatically added to a persistent local character list and selected as the active character. Additional characters can be discovered from the account roster when the game sends it, or on each character's first observed login. For the first session, launch the companion **before** logging into the character.
4. The **mini desktop overlay opens automatically** in a separate always-on-top window. Drag its top bar to move it. Use × to hide it, ↗ to reopen the full companion, or **Show mini overlay / Hide mini overlay** on the main screen. The mini shows character, server, observed bound Kinah, explicit income/spending if known, and up to three recent progress counters. It is a desktop window, not an injected game overlay; exclusive fullscreen mode can obscure it.
5. The app stores the automatic-capture / mini-overlay preferences locally, so the user may pause tracking. The helper defaults to TCP game-server port 13328 as documented for EU; Global may differ, in which case the game port can still be changed in the UI. Use **Record entry** for manual corrections or the **JSONL test feed** for verified externally decoded events.
6. Events are kept in your Electron user data directory as local-ledger.json. No credentials or raw packet captures are stored.
7. When ready to sync, copy config.example.json to config.json and set the **existing website's** Supabase URL and publishable anon key. These are not service-role secrets. Run the additive migration supabase/migrations/20261108_companion_telemetry.sql in Supabase first.
8. Sign in with your existing website account and press **Sync progress**. The desktop app matches by character name and server to your website's player_characters table.

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

The app detects a character's server ID and maps known Aion 2 region/server names using a community catalog. Website linking uses both character name and the recognized server aliases, never an unverified name-only match; mismatched records remain local and are reported as unmatched after sync. The companion does not yet create missing cloud character tabs automatically. Website analysis UI is deliberately not part of this MVP.

## Licensing and account risk

Npcap is **not bundled** and the app will not install the driver or request elevated privileges automatically. Its free license does not permit redistribution of its installer; users who opt into the capture integration must separately install it from npcap.com, subject to its terms. The decoder is based on public MIT-licensed research from SkeeveTV's Aion-DPS-Meter with attribution under `capture/THIRD-PARTY-NOTICES.md`. Third-party game traffic inspection remains unofficial and may violate NCSOFT rules or expose accounts to sanctions. The helper is strictly passive and does not inject code, alter memory, or transmit game commands.

## Next technical milestone

Validate against a real Global login and controlled task changes, including ticket list/update messages (`0x0b61` / `0x0c61`), local character frame (`0x3336`), and bound Kinah inventory snapshots (`0x1156` / `0x1b56`). Confirm packet port, correct name/server identity, and expected values before changing website checkmarks. Research *complete* Kinah income/spend event coverage before enabling automatic gross economic totals. The current reader does not decode nested LZ4 bundles, so coverage can be incomplete.

## Automatic character discovery and mini overlay

- Captured characters are added automatically from the local-character login record (`0x3336`). The companion now also reads the account selection roster (`0x2636` / the large `0x1536`) **when the game sends it**, so multiple characters can appear at once. The roster is not guaranteed to be sent on every login; the character list fills in as the game exposes character identities.
- Unknown/changed server IDs are identified as `Aion 2 server <id>`; this avoids assigning the wrong name. Server-name mapping is based on community research, not an official NCSOFT API.
- A mini, moveable always-on-top Electron window shows the active captured character's concise economy and progress snapshot. It does not draw into the game process and may not appear above exclusive fullscreen games; borderless windowed mode is preferable.
- Capture starts when the companion itself starts, **not on Windows sign-in**. Users may manually pause/resume from the main dashboard; the setting is remembered. No automatic background upload occurs without website sign-in and the explicit Sync action.
- If the game client was already running before capture began, discovery may require relogging or switching characters. No memory inspection or injection is attempted.

## Updated detection diagnostics (automatic game endpoint discovery)

Teleporting across zones may send a fresh own-character frame but does not repair a broken driver or decoder. The Windows capture helper now observes **Windows TCP owner metadata** for `AION2.exe` with the IP Helper API, then includes only the current game-owned IPv4 endpoints in the inbound Npcap filter. This never accesses game memory or sends network data to the website.

- **Game not running:** Launch AION2.exe locally; local capture does not work for cloud-streamed game traffic.
- **Game detected but no TCP connections:** Enter the game world. VPN/accelerators, proxy processes or IPv6-only paths may hide relevant connections.
- **Process connected, packets 0:** The driver cannot see the game flow. Verify Npcap installation, admin-only access settings, and networking adapters. Teleporting repeatedly is unlikely to help.
- **Packets above 0, decoded frames 0:** Npcap sees data, but the current protocol decoder may not match the traffic format, or a VPN tunnel may be interfering.
- **Frames above 0, identity 0:** Some Aion 2 game messages decode, but the character/roster has not been observed. Changing zones or opening character selection can trigger another relevant record.
- **Identity above 0, character missing:** Local character association requires repair.

The main panel now shows the game process, TCP-connection count, Npcap adapter count, captured game packets, decoded frames, and identity records. These are aggregate diagnostics; raw packets, credentials, network addresses and process-memory contents are not recorded or uploaded. The fallback server port is still configurable.

A synthetic test verifies reassembly of a fragmented 40 KB identity frame and Win32 TCP remote-port byte order. Neither proves live Global compatibility. Third-party traffic capture remains unofficial, may violate NCSOFT rules, and can carry account risk.

## Opcode-only diagnostics

This preview distinguishes **character-related opcode received** from **successfully parsed character identity**. The diagnostic panel displays counters for character and roster frames, parsed identities, ticket frames, and a top-8 opcode histogram. Only opcode values and occurrence counts are shown; no game message bytes, player names, IP addresses, credentials, or other packet content are logged. If a 0x3336 frame is received but parsing fails, the current parser likely needs updating for this game release. If no character-related opcodes are received despite many other frames, the capture/framing path or protocol version needs investigation. Do not keep teleporting when the panel explicitly identifies a decoder mismatch.

## LZ4-compressed Aion 2 message bundles

Aion 2 Global inbound 0xFFFF envelopes contain a little-endian uncompressed
size followed by an LZ4 block of varint-framed inner messages. Login, zone,
roster and ticket records can be nested in those bundles. The companion now
decompresses the envelope locally and validates every inner frame boundary
before forwarding messages to the strict character and counter decoder.
No raw traffic or compressed payloads are stored or uploaded. The LZ4 block
decompressor is adapted from the MIT-licensed SkeeveTV/Aion-DPS-Meter project
(see capture/THIRD-PARTY-NOTICES.md). Maximum output is limited to 1 MB and
no nested compression is followed.

Diagnostics now separately count bundles seen, bundles unpacked, failures,
and inner frames. Automated tests use a real 20-message LZ4 bundle fixture
and a synthetic bundle containing a ticket and own-character record.

Live Aion 2 Global compatibility is not yet proven; this remains an
unofficial packet-capture beta with potential NCSOFT policy risk.

## Automatic lobby character discovery

The Aion 2 account lobby and in-world session use different network connections.
The companion now includes the lobby fallback port 13700 (as observed in
community captures) as well as discovery of current AION2.exe TCP endpoints.
World port 13328 remains user-configurable.

The lobby response opcode 0B39 provides the account-character roster. The
companion validates name, server ID, and level using the wire layout documented
by the MIT-licensed nuriland/a2kit project, ignores hidden $-prefixed
placeholders, and builds a local roster. Login tokens, raw packet contents,
account IDs, timestamps and character-selection masks are not exported.

For first-time setup, OPEN THE COMPANION BEFORE LAUNCHING AION 2 and then
start the game normally so the initial lobby response can be observed.
If the character-selection lobby has already been exited, merely teleporting
in the world will not re-send the lobby roster. Existing roster profiles stay
saved locally between restarts.

A lobby roster identifies the account characters; it does not itself prove
which character is presently logged in. A roster with one playable character
is selected for the mini window as a local profile, but account histories,
tickets and wallets are only attributed from confirmed world records.

The main app now displays lobby list packet and character counts separately
from successfully parsed active-world identities. This remains unofficial
passive packet analysis and may have NCSOFT account-policy implications.

## Regular Kinah balance detection and validation

- The companion now scans verified inventory slot records for **930100031**, the Global client item ID for **regular (tradable) Kina**. It keeps **930100001**, the bound Kina item observed in community capture data, as a separate wallet. The virtual combined-price item **930100030** is not treated as a third wallet.
- Incoming full inventory snapshots (0x1156) and slot changes (0x1b56) are parsed for both currencies. A removal record (kind 2) resets the affected wallet to zero. Repeated unchanged readings are deduplicated.
- The desktop dashboard and mini overlay separately show regular and bound Kina. A combined value is only shown after BOTH are observed. "Regular net today" is a net *balance* difference against the first observation since daily reset; it may include payments, market actions, storage movements, and other changes. **It is not gross earnings or mob-only income.**
- Diagnostics expose inventory-frame count, regular-wallet readings, and bound-wallet readings. A player can record the before/after regular Kina balance while killing one mob to check whether the game sends an observable inventory update.
- As with all passive packet analysis, this beta is unofficial and has not been verified against every Global server update. The protocol decoder never inspects game memory or sends packets.

## Website syncing

The new migration `supabase/migrations/20261109_companion_currency_kinds.sql` expands the allowed values of the `currency_kind` column to `bound` and `unbound`; it must be applied before optional Supabase sync of regular Kina snapshots. The base 20261108 telemetry migration should already be installed. Local capture and dashboards work without website configuration.

## Currency UI: blue versus gold, and zero-balance handling

The game's blue currency indicator is **Kina (All)**, not the separate bound-only balance. Kina (All) equals regular Kina plus bound Kina; for example, 462,000 regular and zero bound gives 462,000 All. The companion now uses a shared, unit-tested wallet calculator across full dashboard and mini overlay. It never treats a missing bound observation as a displayed zero: an incomplete capture shows **≥ 462,000** for All until the bound currency is observed. A complete and validated 0x1156 inventory snapshot that contains either currency can establish a missing currency's zero balance, while a partial 0x1b56 change cannot. This inference remains subject to live protocol validation.

Testing: verify **Regular Kina**, **Bound Kina**, and **Kina (All)** against the individual wallet and combined currency displays. Because normal game UI may show only regular and combined totals, compare bound separately in the Cube or derive it from All minus regular.


## Workspace tabs and automatic Kina movements (preview)

The desktop app now opens on **Overview**: character balances, Kina (All), daily progression and a compact movement history. The detailed Npcap traffic and opcode counters, game port, start/pause capture and JSONL test-feed controls are in the separate **Diagnostics** tab in the sidebar. Moving the UI does **not** stop or reduce automatic game capture.

**Observed Kina In / Out** is derived from *successive validated wallet snapshots* for each character, currency, and capture-session ID. A new capture session or character change establishes a fresh baseline: the first observation never counts as gain or expenditure. To avoid fabricated events after a long idle period, changes after >20 minutes between consecutive observations of a given currency also start a new baseline. Existing older observations without a capture-session ID remain visible as balances but are deliberately excluded from these new In/Out totals. The totals reset daily at 07:00 UTC; recent individual movements are retained in the local snapshot history.

These are **observed wallet inflows and outflows**, not independently confirmed market sales, purchases or gross farming income. Positive regular-Kina movement following a Market Settlement claim may appear under In, and an item purchase under Out, but the game may also use the same wallet-update message for dungeon rewards, other expenses, transfers and combined events. Some offsetting actions can occur between snapshots and therefore be missed. Market listing fees may affect bound Kina; both currencies are tracked separately. We do not pretend to classify these balance changes by cause or report exact trading profit.

The mini desktop panel also shows compact daily observed In and Out metrics. It does not display raw traffic.

**Privacy**: capture session IDs are random, local provenance identifiers used solely to separate contiguous wallet observations. They are not account IDs, do not read game memory, and are **not sent to the website** by the optional Supabase synchronization. The movement summaries are calculated locally from existing snapshots; no new database migration is needed beyond the existing currency-kind migration.

### Verify spending and settlement tracking

1. Start the new companion before logging into a character to obtain an initial wallet baseline. The new movement fields can show zero after a baseline; they never invent movement from a missing baseline.
2. Observe a **real** regular-Kina purchase or another purchase you were already planning. The regular wallet should decrease, the dashboard's Observed Out should increase, and a recent balance-change row should show the difference. Bound currency can also decrease for fees or other combined costs.
3. If you have a completed Market sale to claim, open the game's Market → Settlement and claim the existing proceeds. A corresponding regular-Kina balance increase should appear under Observed In if the inventory update was captured. The app **cannot independently verify** this was a sale.
4. If either action changes the in-game wallet but creates no movement, check the **Diagnostics** tab for inventory packets and wallet-reading counts and report those values. Do not share raw PCAPs or any credentials.

Third-party packet capture remains an unofficial beta; consider NCSOFT's terms and any account risks.

## Item-level economy associations (local preview)

**Overview → Wallet Activity → Item-level spending / receipts** groups possible purchases and receipts by item. The decoder reads 0x1156 inventory snapshots as the baseline and 0x1B56 slot updates to observe stack quantity changes. The baseline never counts as earnings. A newly seen stack counts as an inventory addition only after a complete baseline has been recorded. Unknown stack updates do not manufacture prior item gains.

A wallet outflow and an increase in **exactly one item type** within 4.5 seconds and in the same capture session can be displayed as a **possible purchase**. A wallet inflow close to an item removal can be marked a **possible sale**. The UI groups multiple possible Courage Scroll (Bound) purchases by item ID, showing quantities, observed total Kina spent, and per-unit averages. Different items bought together remain unassigned to avoid arbitrary cost allocation. Individual item changes cannot be matched to more than one wallet movement.

**Limitations:** The game does not prove market/NPC transaction origin in these inventory or wallet messages. A coincidental loot or crafting event might occur next to a purchase. Storage transfers, crafting and consumption look like other item changes. A Market settlement can occur long after the sale listing, so the app does **not** attribute delayed settlement proceeds to a specific sold item. The amounts are observed currency changes, not verified market purchase receipts or market profits.

The offline item-name lookup covers 9,450 English client-derived names; unknown IDs appear numerically. Source: https://github.com/l33tm3/FullAIon2Companion. Only item ID and English name metadata is bundled; no third-party artwork, proprietary assets or recipes. Game data ownership remains with NCSOFT.

**Privacy:** New item-change events are local-only and excluded from website synchronization. No game packet bytes, IP addresses, in-game account or market identifiers, process memory or inventory handles are exported or uploaded.

### Live check

1. Launch the companion before Aion 2, then enter the character. Under Diagnostics, Tracked inventory stacks should be greater than zero.
2. When you make an item purchase you already planned, note the item count and regular/bound Kina difference.
3. Check Overview → Observed Out and the new per-item grouping. If no item association appears, check Diagnostics → Item quantity changes.
4. Report the item ID (or name), currency differences, and counters if the grouping is inaccurate—no raw PCAP files are needed.

This is unofficial passive packet capture and may pose an account-policy risk under NCSOFT terms.
