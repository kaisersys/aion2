# Aion 2 Global capture verification checklist

This read-only capture helper is a **beta implementation**. Do not call it production-ready based on synthetic unit tests.

## Preparation
- Install Npcap separately from https://npcap.com/ (not redistributed with the companion).
- Start Atreia Street Companion on Windows and add a character with the exact in-game name and server, or sign into the website account with a matching character.
- Confirm the configured TCP game-server port (default 13328 is sourced from EU research; Global may differ).
- Start capture **before** logging into a character so the initial ticket list and identity record are both seen.

## Verify with the game's own UI
1. Ensure the app reports Npcap listening, and later the correct character name + server.
2. Compare Nightmare attempts and Shugo/Dimensional Invasion keys to the game UI.
3. Use exactly one dungeon entry, confirm one relevant counter update with no duplicate event.
4. Verify login/character-switch snapshots and per-server vs per-character scope.
5. Compare bound Kinah from the currency-item record to the specific bound balance displayed in game. This is **not total Kinah**.
6. Test after Global daily reset (07:00 UTC) and Wednesday weekly reset (07:00 UTC).
7. Stop capture and verify no raw packet captures or unrelated data remain on disk.
8. Test on VPN and without Npcap. Errors should not crash the UI.

## Known gaps
- No independent real-Global-session verification has been performed in this repository.
- The capture reader does not decode nested compressed LZ4 bundles; some events may be missed.
- Only one server port is captured at a time; other ports may require changing it in the app.
- Kinah earned/spent is **not** automatically decoded. Separate transactions must be observed, not guessed from wallet net change.
- A character name that matches more than one server is left unmapped for safety.
- Traffic inspection is unofficial and may conflict with NCSOFT game rules.
