/**
 * arena.ts - Runtime gameplay-space instancing
 *
 * Arena now reuses the same `MoonLobby1.glb` model as the lobby.
 * We keep the arena runtime-generated so it still participates in
 * `trackArenaEntity()` cleanup when returning to the lobby.
 */
import {
  engine,
  GltfContainer,
  Transform,
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { trackArenaEntity } from './gameReset'

const ARENA_X = 48
const ARENA_Y = 0
const ARENA_Z = 48
const ARENA_SCALE = 1.5
const ARENA_MODEL_SRC = 'models/MoonLobby1.glb'

export function buildArena(): void {
  const arenaRoot = engine.addEntity()
  Transform.create(arenaRoot, {
    position: Vector3.create(ARENA_X, ARENA_Y, ARENA_Z),
    scale: Vector3.create(ARENA_SCALE, ARENA_SCALE, ARENA_SCALE),
  })

  const arenaModel = engine.addEntity()
  Transform.create(arenaModel, {
    parent: arenaRoot,
    position: Vector3.create(0, 0, 0),
    scale: Vector3.create(1, 1, 1),
  })

  GltfContainer.create(arenaModel, {
    src: ARENA_MODEL_SRC,
  })

  trackArenaEntity(arenaRoot)
}
