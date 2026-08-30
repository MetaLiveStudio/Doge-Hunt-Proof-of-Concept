---
name: doge-hunt-authoritative-development
description: Develop, debug, review, or release the Doge Hunt Decentraland SDK7 authoritative multiplayer scene. Use for room flow, authoritative server, NPC or real-player synchronization, spectator UX, mobile UI, Creator Hub Preview failures, scoring, leaderboard persistence, or deployment verification in this checkout.
---

# Doge Hunt Authoritative Development

Use this skill only in the Doge Hunt Proof of Concept checkout. Treat the authoritative server as source of truth for room membership, match state, BONK validation, NPC state, survival, final rank, and leaderboard awards.

## Start Every Task

1. Read `tasks.md`, `git status --short`, and the smallest relevant source area.
2. Classify the request: gameplay authority, room lifecycle, visual synchronization, mobile UI, leaderboard, Preview/tooling, or release verification.
3. Read [official sources](references/official-sources.md) for SDK/API uncertainty. Read [project lessons](references/project-lessons.md) before multiplayer, Preview, mobile, or score changes.
4. Keep work to one coherent behavior slice. Isolate difficult server/Preview risks before combining them, but do not create artificial micro-phases.

## Boundaries

- Server owns hits, eliminations, winner, rank, score, and persisted state. Clients only request actions and present confirmed results.
- Keep protocol/state in `src/shared/`, server systems in `src/server/`, and client input/proxies/UI in `src/client/` or the established top-level modules.
- Distinguish active players, eliminated in-match spectators, and external spectators. Only external spectators consume the five-seat observer cap.
- Do not change package versions, `scene.json`, or authoritative runtime configuration to solve a scene-logic issue before identifying whether the fault is code, watcher/process state, local content service, or runtime.
- Preserve unrelated dirty changes and do not stop Creator Hub/Preview processes unless necessary and authorized.

## Implement

### Authoritative Gameplay

- Broadcast server-owned NPC/player state. Never independently randomize NPC paths or infer match outcomes on each client.
- Keep private identity data recipient-specific; emit only necessary presentation state in public snapshots.
- Reuse one ranking function for results UI, time-up winner selection, and score awards.
- Make reload/resume idempotent: request a personalized snapshot and resume payload, never treat HMR/mobile wake as a leave.

### UI and Mobile

- Use `ScreenInsetArea` for mobile controls and tutorial UI near system insets. Keep desktop layout unchanged unless requested.
- Check every HUD addition against timer, real-player count, debug controls, native mobile controls, result modal, and spectator indicator.
- During anonymous active play hide default avatars, name tags, and passport interaction. In spectator presentation show real-player proxy names only; NPCs stay unlabelled.
- Treat mobile model/scale differences as presentation-only unless server hit testing and proxy geometry are intentionally changed together.

### Preview and Logging

- Keep structured log prefixes, match IDs, snapshot versions, transition reasons, and concise state counts.
- Treat type/build evidence and Creator Hub Preview evidence as independent. Preview is mandatory for user-visible multiplayer/mobile claims.
- Prefer hot reload for ordinary checks; clean stale processes only after diagnosing an actual stuck service.

## Verify

After edits run:

```powershell
& .\node_modules\.bin\tsc.cmd --noEmit
git diff --check
```

Run the SDK build when package, scene, deploy, or generated-scene behavior changes. For multiplayer use two wallets/sessions. For mobile and release, follow the matrix in [project lessons](references/project-lessons.md).

## Source Map

- Authority, room, match, combat: `src/server/serverLobby.ts`
- Persistent scores: `src/server/leaderboard.ts`
- Shared schemas, ranking, protocol: `src/shared/`
- Client public state and requests: `src/client/serverPublicStateClient.ts`, `src/client/serverGameplayClient.ts`
- Remote proxies: `src/client/remotePlayerProxies.ts`
- HUD/results/lobby/avatar behavior: `src/uiManager.ts`, `src/lobby.ts`, `src/player.ts`

