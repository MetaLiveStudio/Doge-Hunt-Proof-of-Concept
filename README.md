# Doge Hunt - Decentraland Mobile Game

**Doge Hunt** is a social deduction game developed using Decentraland SDK7, specifically optimized for the mobile client.

> **Core Objective**: Create a gaming experience tailored for the Decentraland mobile app, rather than a generic web-based experience.

## Core Rules

All AI agents, developers, and contributors must adhere to the following rules:

1. **Task Logging Requirement**:
   - A `tasks.md` file must be maintained in the project root.
   - **Before starting any new task**, you must read and understand the history and current plans in `tasks.md`.
   - **Upon completing a task**, you must immediately update `tasks.md` with the task description, status, and follow-up plans.
2. **Preview Mode Restriction**:
   - **Strictly no unauthorized use of preview mode**. All previewing and verification are handled manually by designated personnel.

## Current Features

- **Mobile Optimization**: UI and interactions designed for small screens and touch controls.
- **Muscledoge Animation System**: Full animation set support (idel, walk, run, jump, Bonk).
- **Melee Combat System**: Uses forward hit detection with support for combo interruption and rhythm tuning.
- **Humanized NPCs**: NPCs feature random state machine behaviors (patrol, pause, jump, attack) and perfect ground alignment.
- **Third-Person Camera**: A smooth follow-camera system specifically tuned for mobile devices.
- **Environment System**: Reuses `MoonLobby1.glb` as the Arena base, supporting runtime instantiation and cleanup.

## Project Structure

```
src/
  index.ts        — Entry point, initializes all systems
  arena.ts        — Arena generation logic (based on MoonLobby1.glb)
  lobby.ts        — Lobby environment management
  npc.ts          — NPC spawning, patrol state machine, and animation management
  player.ts       — Player appearance, movement follow, and animation sync
  combat.ts       — Melee hit detection and kill logic
  cameraRig.ts    — Third-person smooth camera system
  uiManager.ts    — Core UI logic and React-ECS interface
  gameState.ts    — Global game state management
  gameReset.ts    — Game reset and entity cleanup logic
  hud.ts          — In-game HUD interface
  skills.ts       — Skill system (e.g., Rock Solid)
  ui.ts / gameOverUI.ts — Auxiliary UI components
```

## Technical Specifications

- **SDK Version**: Decentraland SDK7 (ECS7)
- **UI Framework**: `@dcl/react-ecs`
- **Performance Optimization**:
  - Strictly control the number of entities.
  - Texture sizes recommended to be no larger than 512x512.
  - Avoid high-overhead calculations in every frame (Systems).

## Development Guide

### Install Dependencies
```bash
npm install
```

### Start Development (Compilation Check Only)
```bash
# Note: Per Core Rules, do not view the preview interface without authorization
npm start
```

## Task Tracking

Always refer to and update the [tasks.md](tasks.md) file in the project root for the latest task progress and to-do items.
