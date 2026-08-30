# Project Lessons and Failure Modes

These are Doge Hunt-specific lessons from the Main history and the NPC/HUD task. Revalidate after meaningful SDK, Creator Hub, or architecture changes.

Source task histories:

- Main: `codex://threads/019f0d82-fce7-7893-af84-d1bd8d87dc8a`
- NPC range and HUD: `codex://threads/019fad1e-d9ba-7dc3-ad41-ecba96d9ab67`

## Authority and Match Rules

- One server room supports ten active players and five external spectators. Eliminated participants are retained match records and do not consume external seats.
- Server validates BONK from observed `PlayerIdentityData` plus `Transform`, owns Doge/NPC state, and broadcasts snapshots. Remote peer transforms improve visual smoothness only; they never decide hits or outcomes.
- Rank: winner first; surviving active players above eliminated players; survivors by BONKs; eliminated players by later elimination order. Leaving counts as elimination.
- At multiplayer time-up choose the winner with the same ranking function used by results and awards. Solo wins only by clearing all NPCs; solo timeout is not a victory.
- Awards: solo `+1`, cap `10/day`; multiplayer top four `20/10/5/3`, cap `100/day`; ranks five to ten receive no points. Week rolls Monday UTC. De-duplicate writes by match ID.
- Total Doges are `max(12, activePlayers * 2)`: solo has 11 NPCs, two players 10 NPCs, and higher populations retain at least one NPC per player.

## Presence, Resume, and Spectator Flow

- Require non-host Ready before host Start. Broadcast snapshots on all state changes and heartbeat regularly.
- If no active human players remain, reset without results or awards. Use a grace check before final-survivor resolution after heartbeat loss because mobile wake/reload can resemble a disconnect.
- HMR/reload/mobile wake must request personalized room state and resume without spawning/teleporting as a new player.
- Result settling lasts 30 seconds with a closing countdown. Remove external spectators on reset.
- External spectators are read-only, hidden/non-colliding/non-selectable, see real-player proxy names, and get neutral `ROUND FINISHED` results. Eliminated players choose `SPECTATE` or `RETURN TO LOBBY` during a still-active round.

## Creator Hub and Preview Failures

- Build success does not prove Preview works. `GET /about` can pass while `POST /content/entities/active` times out, indicating realm/content-service failure rather than TypeScript.
- Historical symptoms `EPIPE`, stale watchers, `DUPLICATE_IDENTITY`, and empty scenes demand process/path/watcher inspection before code changes.
- A clean copied checkout can isolate dependency/watcher pollution; do not overwrite the primary project during diagnosis.
- Hammurabi/`isolated-vm` once inherited Electron Node 24. Check the whole process tree; clearing `ELECTRON_RUN_AS_NODE` and using the intended Node runtime fixed that class of failure.
- Keep `logsPermissions` for authorized deployment diagnostics. Prefer hot reload; only clean stale processes when the service is actually stuck.

## Mobile, HUD, NPC, and Proxy Lessons

- Put Rock/Bonk and HOW TO PLAY inside `ScreenInsetArea`. Test Dynamic Island iPhone, short iPhone, and Android in landscape.
- On each mobile profile check tutorial, timer, alive count, controls, elimination choice, spectator HUD, result pagination, and return button.
- Keep native mobile camera; desktop follow camera is unsafe around mobile collider edges. Block native pointer BONK when using the custom BONK button to avoid duplicates.
- Keep action buttons equal-size/aligned. Rock image is opaque while hiding and semi-transparent during cooldown; status text needs black outline.
- Use arena avatar modifiers to hide default avatars, name tags, and passports in active anonymous play. `VisibilityComponent` alone does not disable interaction; also remove/restore `MeshCollider`.
- NPC movement area is circle center `(48,48)`, radius `36m`; clamp movement in bounds. Multiplayer NPC snapshots are authoritative. Repeated one-second snapping means competing stale/client state, not a cosmetic interpolation-only problem.
- Lowering the Rock visual must not move its collision/return anchor. Restore player to cached safe position on disguise end.

## Release Matrix

1. Run TypeScript and diff checks; run SDK build when appropriate.
2. Preview the exact changed behavior and record client/server logs with match ID and snapshot version.
3. Two wallets: room state, Ready, Start, hit/miss, player elimination, spectator choice, proxies, final rank, rejoin.
4. Mobile: three device classes above.
5. Deployed: repeat two-wallet flow; confirm logs, persisted score, player name on board, rollover, and admin CSV export.
