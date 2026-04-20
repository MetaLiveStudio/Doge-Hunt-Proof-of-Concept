# Doge Hunt — MVP Scene

Trust No Doge. A social deduction game demo for Decentraland Worlds (SDK7).

## What's in this demo

- **Neon-noir arena**: Dark floor with cyan grid, glowing walls, 7 pillars, corridor obstacles
- **12 NPC Doges**: Identical avatars patrolling random waypoints with "NPC or Player?" labels
- **Click-to-bonk**: Click any NPC within range → knockback + permanent knockout
- **Kill feed**: Meme-style floating messages ("Such eliminate. Very dead. Wow.")
- **HUD**: Bonk counter, alive counter, round timer (3 min) + instructions
- **Player disguise**: You appear as a Doge to other players
- **Rock Solid skill**: Press E near a pillar to hide

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Start local preview
npm start
```

This opens a browser preview at `http://localhost:8000`. Walk around the arena and click Doges to bonk them.

## Project structure

```
src/
  index.ts    — Entry point, bootstraps all systems
  arena.ts    — Arena geometry (floor, walls, pillars, neon strips)
  npc.ts      — NPC spawning, patrol component + system
  combat.ts   — Hit detection, knockback, knockout, kill messages
  ui.ts       — Kill feed, welcome sign, HUD overlay
  player.ts   — Player disguise system
  skills.ts   — Rock Solid skill (press E to hide near pillars)
  hud.ts      — Game HUD setup
```

## Requirements

- Node.js 18+
- Decentraland SDK7: `@dcl/sdk ^7.6.0`
- `@dcl-sdk/utils ^1.2.0`

## Scene config

- **Parcels**: 3×3 (48m × 48m)
- **Spawn**: Near southwest corner, facing center

## Customization

### Change NPC count

In `src/index.ts`, change `spawnAllNpcs(12)` to any number (4-16 recommended).

### Change NPC speed

In `src/npc.ts`, adjust the speed range in `spawnNpc()`:

```typescript
speed: 1.0 + Math.random() * 0.8  // 1.0 - 1.8 m/s
```

### Change arena colors

In `src/arena.ts`, modify the color constants at the top of the file.

### Add Doge wearables

When you have custom Doge wearable URNs, update the `DOGE_WEARABLES` array in `src/npc.ts`.

## Next steps (Phase 1 → full game)

### PHASE 1 — NETWORKING & CORE GAMEPLAY

**Networking**

- Colyseus server + room management
- PlayFab auth
- Server-authoritative attack validation
- Basic NPC/Player sync

**Game Flow**

- Lobby: waiting for players to join (configurable min players 2-8)
- Player/NPC ratio settings: balanced mode, many impostors mode, etc.
- Countdown: 10s countdown before round starts
- Active: main gameplay phase (3 min default, configurable)
- Results: ranking & score display

**Spectator Mode**

- Dead players become spectators

  <br />

### PHASE 2 — CONTENT ENHANCEMENT

**Art**&#x20;

- Doge model: walk/swing/death animations
- Model enhancement
- Hit sparks, elimination effects

**UI**

- HUD: timer, alive count, kill feed
- Lobby screen with player list
- Round start countdown overlay
- Results screen: ranking, bonks, time survived, score breakdown

**Skills (pickup-based, below are examples)**

- Rock Solid: hide as scene object (5s)
- X-Ray Vision: reveal nearby players (3s)
- Play Dead: fake death (3s)
- Dash: speed burst

### PHASE 3 — PROGRESSION & LAUNCH

**Audio**

- BONK sound, countdown, ambient sound

**Long term game economy**

- Leaderboards

**Wearable Rewards**

- Milestone wearables

**Mobile Adaptation**

- Touch-friendly UI scaling for small screens
- Tap-to-bonk design
- HUD repositioning for portrait/landscape

**Testing**

- Unit tests for game logic (combat, scoring, round flow)
- Integration tests for Colyseus sync
- Load testing with bot players
- Cross-browser & mobile device testing

**Optimization**

- Entity culling for distant NPCs
- Network traffic minimization
- Memory profiling & leak detection
- FPS optimization (target 60fps on mid-range devices)

