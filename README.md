# Doge Hunt

A multiplayer Decentraland game where players hide among identical Doges, BONK suspicious targets, and try to be the last real player standing.

Works on desktop and mobile Explorer. The server decides rooms, hits, eliminations, rankings, and leaderboard awards.

## Play

1. Click the lobby Doge head to create or join a room.
2. Non-host players select `I'M READY`.
3. The host starts when everyone else is ready, or starts a solo practice round after confirmation.
4. BONK suspicious Doges. A confirmed hit removes either a real player or an NPC decoy. NPC swing animations never damage players.
5. In multiplayer, the last real player standing wins. In solo, clear all NPCs to win.

## Rooms and Spectating

- Up to 10 active players per room.
- Up to 5 external spectators during a live match.
- Eliminated players can spectate without using an external seat.
- Spectators are read-only and see real-player names; active players remain anonymous.
- If no active human players remain, the server resets the round without results or awards.

## Leaderboard

| Match type | Award | Daily cap |
| --- | --- | --- |
| Solo | +1 for clearing all NPCs | 10 points |
| Multiplayer | Ranks 1-4: +20 / +10 / +5 / +3 | 100 points |

The weekly board rolls over on Monday UTC. Scores and awards are server-owned; admin wallets can export CSV from the lobby.

## Development

```bash
npm install
npm start
npm run build
npm run deploy
npm run server-logs
```

`npm install` restores dependencies from `package-lock.json`. Do not commit `node_modules/` or local editor, AI-context, thumbnail, and tool-wrapper files; they are intentionally ignored.

Run before submitting changes:

```bash
npx tsc --noEmit
npm run build
git diff --check
```

Build success does not replace manual Creator Hub, mobile, or two-player multiplayer testing. See `tasks.md` for the current task log and preview checklist.

## Configuration

- Required SDK7 release: `7.26.1-32239895147.commit-3c77d90` for `@dcl/sdk`, `@dcl/js-runtime`, and `@dcl/sdk-commands`. Keep all three packages on the same release; this project needs its scene-side multiplayer server support.
- UI: `@dcl/react-ecs`
- World: `playandearn.dcl.eth`
- Server multiplayer enabled in `scene.json`
