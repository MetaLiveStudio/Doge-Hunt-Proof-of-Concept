# Doge Hunt Task Log

This document records all development tasks and progress for the Doge Hunt project.

## Task History

| Date | Task Description | Status | Executor | Notes |
| :--- | :--- | :--- | :--- | :--- |
| 2026-06-02 | Translate README.md to English | Completed | AI Assistant | Completely rewrote README.md in English to match project standards. |
| 2026-06-02 | Translate project rules and tasks to English | Completed | AI Assistant | Switched the language of documentation and rules to English as per user request. |
| 2026-06-02 | Update README.md | Completed | AI Assistant | Rewrote README to reflect mobile goals, core rules (task logging/preview limits), and latest features. |
| 2026-06-02 | Update Project Rules and Establish Task Logging | Completed | AI Assistant | Added technical specs and task logging requirements to `.trae/rules/decentraland.md`. |
| 2026-06-02 | Initial POC Scan and Structure Planning | Completed | AI Assistant | Scanned project structure, main loop, UI, and state flow; proposed cleanup for `uiManager.ts`. |
| 2026-06-02 | Melee Combat: Point-click to Forward Hit Detection | Completed | AI Assistant | Changed "click NPC to kill" to forward-facing hit window detection. |
| 2026-06-02 | Player Appearance, Camera, and Movement Tuning | Completed | AI Assistant | Added 3rd-person follow camera; tuned player rotation and height alignment. |
| 2026-06-02 | NPC Ground Alignment and Hitbox Tuning | Completed | AI Assistant | NPCs now snap to ground height; enlarged hitboxes and attack ranges. |
| 2026-06-02 | Player Animation Upgrade (Muscledoge) | Completed | AI Assistant | Integrated `idel / walk / run / jump / Bonk` animations; fixed sprint modifier keys. |
| 2026-06-02 | NPC Animation State Machine (v1) | Completed | AI Assistant | Added random state switching for NPCs (idle/walk/run/jump/Bonk). |
| 2026-06-02 | NPC Squish Animation on Hit | Completed | AI Assistant | NPCs now squish down before turning into the `SmallDoge` death model. |
| 2026-05-28 | UI Skill Text Update | Completed | AI Assistant | Changed skill hint to "Rock Solid — New skills coming soon!". |
| 2026-05-28 | Removed 3D Broadcast Boards | Completed | AI Assistant | Removed central 3D timer, counters, and kill feed from the arena. |
| 2026-05-28 | Removed Floating Text Above NPCs/Players | Completed | AI Assistant | Cleaned up world UI labels for better immersion. |
| 2026-05-28 | Fixed Game Over "Return to Lobby" Button | Completed | AI Assistant | Refactored UI click logic to fix broken button events and cleanup routines. |
| 2026-05-28 | Replaced Procedural Arena with MoonLobby1.glb | Completed | AI Assistant | Switched to instantiating the lobby model as the arena base for better design. |
| 2026-05-28 | UI Text Logic Optimization | Completed | AI Assistant | Victory shows "Round Complete" & "You Win", failure shows "GAME OVER" & "You Lose". |
| 2026-05-28 | HUD Panel Position Adjustment | Completed | AI Assistant | Moved main game HUD from the bottom-right corner to the center-left position (left: s(42)). |

## Current Plans / To-Do List
- [ ] Continue manual playtesting to fine-tune `jump` duration and `Bonk` feel.
- [ ] Monitor NPC state switching frequency (adjust `Bonk/jump` probability).
- [ ] Investigate invisible walls/colliders in `MoonLobby1.glb` instance.
- [ ] Scale NPC patrol zones and skill triggers to match `1.5x` arena scale.
- [ ] Refactor `uiManager.ts` to decouple state management from UI layout.
