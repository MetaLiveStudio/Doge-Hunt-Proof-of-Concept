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

4. **Authoritative server migration requires extra logging**
   - Treat authoritative server work as high-risk because failures may come from SDK package compatibility, Hammurabi/auth-server runtime behavior, or Creator Hub preview integration.
   - Split authoritative server work into small checkpoints. Do not combine dependency changes, `scene.json` changes, `isServer()` branching, message registration, and gameplay migration in one phase.
   - Before each authoritative server checkpoint, record the intended scope and rollback boundary in `tasks.md`.
   - After each checkpoint, record exact files changed, commands run, tool/package versions when relevant, warnings/errors, and whether the result was build-only or preview-tested.
   - Use clear log prefixes such as `[Client]`, `[Server]`, `[AuthServer]`, and `[Resolver]` for any new logs related to server migration.
   - On Windows dependency checkpoints, do not rely on bare `npm` or `npx` if they resolve through user-prefix shims. Prefer an explicit Node/npm CLI path and a known writable temporary npm cache, and record both paths in `tasks.md`.
   - Preview or Creator Hub smoke tests require explicit user authorization and must be logged separately from code/build checks.
   - If an authoritative server checkpoint fails, stop and document the failing command, the first relevant error, suspected layer (package, scene config, server runtime, Creator Hub, or gameplay code), and the smallest rollback path before continuing.
   - Do not run a no-client probe from the same project path while a Creator Hub/Explorer preview for that path is active. Even with a different HTTP port, Hammurabi/LiveKit can derive the same preview room identity from the scene path and kick the authoritative server with `DUPLICATE_IDENTITY`.
   - Do not leave multiple preview servers running from the same project path, even if they listen on different HTTP ports. Before judging server-message behavior, confirm there is only one active same-path preview server; stop stale CLI preview processes while preserving the user's active Creator Hub preview.
   - If Creator Hub preview is active and backend verification is needed, either use the live Creator Hub preview only, or copy the project to a scratch path before running a no-client probe so it gets a distinct LiveKit preview room.
   - If `DUPLICATE_IDENTITY` appears, restart the active preview server and Explorer before judging gameplay/message code. A stuck client state after this error may only mean the server comms transport was kicked before messages could arrive.
   - The original `Doge Hunt Proof of Concept` path is considered contaminated for auth-server Creator Hub preview work. Continue authoritative-server migration from `Doge Hunt Auth Clean` unless the user explicitly decides otherwise.

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
