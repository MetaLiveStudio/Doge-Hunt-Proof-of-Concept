# Debug Session: spawn-dome

Status: OPEN

## Symptom
- A small hemispherical / dome-like object appears near the player spawn point in the arena.
- The object looks unintended and visually resembles a half sphere.

## Scope
- Investigate cause only first.
- No business-logic fix applied yet.

## Falsifiable Hypotheses
1. A runtime primitive entity near spawn is being created intentionally as a marker, pad, or debug artifact.
2. A skill/disguise system is spawning a placeholder geometry at the player position and not hiding it correctly.
3. A lobby or arena helper entity is being moved/hidden improperly, leaving behind a visible child mesh near spawn.
4. The imported arena model contains a separate small dome mesh positioned around the gameplay origin after scaling/placement.
5. A world-UI or effects system is creating a geometry base under the player/NPC and the current material/mesh choice makes it look like a dome.

## Initial Evidence Plan
- Search codebase for sphere/cylinder/circle/dome-like primitive creation around spawn and arena startup.
- Inspect player spawn flow, arena build flow, skill disguise flow, and UI/effect entity creation.
- If static evidence is insufficient, add minimal instrumentation next.

## Static Findings
- No code path in `src/` creates a sphere / dome primitive near spawn. The only explicit runtime primitive near the player is the Rock Solid disguise slab, which is a box and remains hidden below ground until the skill is triggered.
- Player spawn is at `(48, 1.2, 48)`, which is also the arena model root position.
- `MoonLobby1.glb` contains multiple sphere-like mesh names and explicit collider/helper nodes near the model origin:
  - `Land_Collider`
  - `Starlight_Collider`
  - multiple meshes whose names decode to sphere-like objects (`球体...`)
- `arena.ts` currently loads `MoonLobby1.glb` with `invisibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS`, so the model's hidden collider helpers are explicitly being consumed at runtime.

## Hypothesis Status
1. Runtime marker/debug primitive near spawn is being created by TS code. -> Rejected by static search.
2. Skill/disguise system spawns a placeholder geometry and leaves it visible. -> Rejected by code shape/placement; it is a box hidden at `y = -10` until activated.
3. Hidden/moved lobby child is leaving a visible artifact near spawn. -> Not primary cause for the visible dome at spawn; still possible for collider side-effects, but weak for this symptom.
4. Imported arena model contains a separate dome/helper mesh at the gameplay origin. -> Strongly supported.
5. World UI/effect base geometry is rendering as a dome. -> Rejected by static search.
