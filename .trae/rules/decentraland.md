# Doge Hunt Project Rules

We are developing **Doge Hunt**, a Decentraland-based mobile game. Our goal is to build for the Decentraland mobile client first, not a generic web experience.

## Core Rules

1. **Task logging is mandatory**
   - Keep `tasks.md` up to date in the project root.
   - Before starting any new task, read `tasks.md` and understand the current history and active plans.
   - Immediately after finishing a task, update `tasks.md` with the task description, status, issues, and next steps.

2. **Preview mode is restricted**
   - Do not launch preview mode without explicit authorization.
   - Previewing and verification are handled manually by designated personnel.

3. **Incremental migration is mandatory**
   - The long-term product direction is multiplayer Doge Hunt, but implementation must move in small, reversible phases.
   - Each phase should keep the current single-player build runnable unless the user explicitly approves a larger breaking change.
   - Do not introduce or modify authoritative multiplayer server code, `authoritativeMultiplayer`, `isServer()`, `registerMessages()`, server runtime dependencies, or server/client entry splitting unless the user explicitly asks for that phase.
   - Prefer first implementing multiplayer-shaped concepts locally, such as room state, player count, ready/start UI, and match lifecycle, using the existing single-player runtime.
   - After each phase, verify with build/type checks. Do not depend on preview to discover basic compile or integration failures.

## Technical Specifications

1. **SDK and UI**
   - Use Decentraland SDK7 / ECS7 and its standard components.
   - Prefer `@dcl/react-ecs` for UI.

2. **Mobile optimization**
   - Keep entity and triangle counts under control.
   - Prefer texture sizes at or below `512x512` when possible.
   - Avoid expensive per-frame calculations and unnecessary allocations inside systems.

3. **Architecture**
   - Follow data-driven design: logic in systems, state in components.
   - Keep code modular and extract shared behavior into utilities or dedicated systems.
   - Keep gameplay lifecycle state explicit and easy to inspect before moving it to real networking.
   - Avoid large cross-cutting rewrites when a narrower local-state change can validate the same product behavior.

## Reference Resources

- [Decentraland - Building for Mobile Guide Book](https://confirmed-copper-f3a.notion.site/Decentraland-Building-for-Mobile-2f55f96e0b70805785abdaba16c5f763)
- [Decentraland Skills (OpenDCL)](https://github.com/dcl-regenesislabs/opendcl)
